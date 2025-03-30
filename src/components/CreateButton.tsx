import { Navigator, useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import log from "loglevel";
import { Accessor, Setter, createEffect, createSignal, on } from "solid-js";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { ButtonLabelParams, EIP6963ProviderDetail } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import {
    deriveKeyFn,
    newKeyFn,
    notifyFn,
    tFn,
    useGlobalContext,
} from "../context/Global";
import {
    Signer,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import { GasNeededToClaim, getSmartWalletAddress } from "../rif/Signer";
import { Pairs, fetchBolt12Invoice, getPairs } from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { HardwareSigner } from "../utils/hardware/HadwareSigner";
import { coalesceLn, isMobile } from "../utils/helper";
import { fetchBip353, fetchLnurl } from "../utils/invoice";
import {
    SomeSwap,
    createChain,
    createReverse,
    createSubmarine,
} from "../utils/swapCreator";
import { validateResponse } from "../utils/validation";
import LoadingSpinner from "./LoadingSpinner";

// In milliseconds
const invoiceFetchTimeout = 25_000;

export const getClaimAddress = async (
    assetReceive: Accessor<string>,
    signer: Accessor<Signer>,
    onchainAddress: Accessor<string>,
): Promise<{ useRif: boolean; gasPrice: bigint; claimAddress: string }> => {
    if (assetReceive() === RBTC) {
        const [balance, gasPrice] = await Promise.all([
            signer().provider.getBalance(await signer().getAddress()),
            signer()
                .provider.getFeeData()
                .then((data) => data.gasPrice),
        ]);
        log.debug("RSK balance", balance);

        const balanceNeeded = gasPrice * GasNeededToClaim;
        log.debug("RSK balance needed", balanceNeeded);

        if (balance <= balanceNeeded) {
            log.info("Using RIF smart wallet as claim address");
            return {
                gasPrice,
                useRif: true,
                claimAddress: (await getSmartWalletAddress(signer())).address,
            };
        } else {
            log.info("RIF smart wallet not needed");
        }
    }

    return {
        gasPrice: 0n,
        useRif: false,
        claimAddress: onchainAddress(),
    };
};

export const createSwap = async (
    navigate: Navigator,
    t: tFn,
    notify: notifyFn,
    newKey: newKeyFn,
    deriveKey: deriveKeyFn,

    ref: Accessor<string>,
    rescueFileBackupDone: Accessor<boolean>,
    pairs: Accessor<Pairs>,
    swapType: Accessor<SwapType>,
    assetSend: Accessor<string>,
    assetReceive: Accessor<string>,
    sendAmount: Accessor<BigNumber>,
    receiveAmount: Accessor<BigNumber>,
    invoice: Accessor<string>,
    signer: Accessor<Signer>,
    providers: Accessor<Record<string, EIP6963ProviderDetail>>,
    getEtherSwap: () => EtherSwap,
    hasBrowserWallet: Accessor<boolean>,

    claimAddress: string,
    useRif: boolean,

    setPairs: Setter<Pairs>,
    setInvoice: Setter<string>,
    setInvoiceValid: Setter<boolean>,
    setOnchainAddress: Setter<string>,
    setAddressValid: Setter<boolean>,
    setSwapStorage: (swap: SomeSwap) => Promise<void>,
): Promise<boolean> => {
    // Mobile EVM browsers struggle with downloading files
    const isMobileEvmBrowser = () => isMobile() && hasBrowserWallet();

    if (
        !rescueFileBackupDone() &&
        swapType() !== SwapType.Reverse &&
        assetSend() !== RBTC &&
        // Only disable refund files on mobile EVM browsers when one side is RSK
        !(assetReceive() === RBTC && isMobileEvmBrowser())
    ) {
        navigate("/backup");
        return false;
    }

    try {
        let data: SomeSwap;
        switch (swapType()) {
            case SwapType.Submarine:
                data = await createSubmarine(
                    pairs(),
                    coalesceLn(assetSend()),
                    coalesceLn(assetReceive()),
                    sendAmount(),
                    receiveAmount(),
                    invoice(),
                    ref(),
                    useRif,
                    newKey,
                );
                break;

            case SwapType.Reverse:
                data = await createReverse(
                    pairs(),
                    coalesceLn(assetSend()),
                    coalesceLn(assetReceive()),
                    sendAmount(),
                    receiveAmount(),
                    claimAddress,
                    ref(),
                    useRif,
                    newKey,
                );
                break;

            case SwapType.Chain:
                data = await createChain(
                    pairs(),
                    assetSend(),
                    assetReceive(),
                    sendAmount(),
                    receiveAmount(),
                    claimAddress,
                    ref(),
                    useRif,
                    newKey,
                );
                break;
        }

        if (!(await validateResponse(data, deriveKey, getEtherSwap))) {
            navigate("/error");
            return false;
        }

        await setSwapStorage({
            ...data,
            signer:
                // We do not have to commit to a signer when creating submarine swaps
                swapType() !== SwapType.Submarine
                    ? signer()?.address
                    : undefined,
            derivationPath:
                swapType() !== SwapType.Submarine &&
                signer() !== undefined &&
                customDerivationPathRdns.includes(signer().rdns)
                    ? (
                          providers()[signer().rdns]
                              .provider as unknown as HardwareSigner
                      ).getDerivationPath()
                    : undefined,
        });

        setInvoice("");
        setInvoiceValid(false);
        setOnchainAddress("");
        setAddressValid(false);

        navigate("/swap/" + data.id);

        return true;
    } catch (err) {
        if (err === "invalid pair hash") {
            setPairs(await getPairs());
            notify("error", t("feecheck"));
        } else {
            notify("error", err);
        }

        return false;
    }
};

const CreateButton = () => {
    const navigate = useNavigate();
    const {
        separator,
        setSwapStorage,
        denomination,
        pairs,
        setPairs,
        online,
        notify,
        ref,
        t,
        newKey,
        deriveKey,
        rescueFileBackupDone,
    } = useGlobalContext();
    const {
        invoice,
        lnurl,
        assetSend,
        assetReceive,
        onchainAddress,
        receiveAmount,
        swapType,
        sendAmount,
        amountValid,
        pairValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setOnchainAddress,
        valid,
        addressValid,
        setAddressValid,
        minimum,
        maximum,
        invoiceValid,
        invoiceError,
        bolt12Offer,
        setBolt12Offer,
    } = useCreateContext();
    const { getEtherSwap, signer, providers, hasBrowserWallet } =
        useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [buttonClass, setButtonClass] = createSignal("btn");
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });

    createEffect(() => {
        setButtonClass(!online() ? "btn btn-danger" : "btn");
    });

    createEffect(
        on(
            [
                valid,
                amountValid,
                addressValid,
                invoiceValid,
                pairValid,
                swapType,
                lnurl,
                online,
                minimum,
                assetReceive,
                bolt12Offer,
            ],
            () => {
                if (!online()) {
                    setButtonLabel({ key: "api_offline" });
                    return;
                }
                if (!pairValid()) {
                    setButtonLabel({ key: "invalid_pair" });
                    return;
                }
                if (
                    !amountValid() &&
                    // Chain swaps with 0-amount that do not have RBTC as sending asset
                    // can skip this check
                    !(
                        swapType() === SwapType.Chain &&
                        assetSend() !== RBTC &&
                        sendAmount().isZero()
                    )
                ) {
                    const lessThanMin = Number(sendAmount()) < minimum();
                    setButtonLabel({
                        key: lessThanMin ? "minimum_amount" : "maximum_amount",
                        params: {
                            amount: formatAmount(
                                BigNumber(lessThanMin ? minimum() : maximum()),
                                denomination(),
                                separator(),
                            ),
                            denomination: denomination(),
                        },
                    });
                    return;
                }
                if (assetReceive() === RBTC && !addressValid()) {
                    setButtonLabel({ key: "please_connect_wallet" });
                    return;
                }
                if (swapType() !== SwapType.Submarine) {
                    if (!addressValid()) {
                        setButtonLabel({
                            key: "invalid_address",
                            params: { asset: assetReceive() },
                        });
                        return;
                    }
                } else {
                    if (validWayToFetchInvoice()) {
                        setButtonLabel({ key: "create_swap" });
                        return;
                    }
                    if (!invoiceValid()) {
                        setButtonLabel({
                            key: invoiceError() || "invalid_invoice",
                        });
                        return;
                    }
                }
                setButtonLabel({ key: "create_swap" });
            },
        ),
    );

    const validWayToFetchInvoice = (): boolean => {
        return (
            swapType() === SwapType.Submarine &&
            (lnurl() !== "" || bolt12Offer() !== undefined) &&
            amountValid() &&
            sendAmount().isGreaterThan(0) &&
            assetReceive() !== assetSend()
        );
    };

    const fetchInvoice = async () => {
        if (lnurl() !== undefined && lnurl() !== "") {
            log.info("Fetching invoice from LNURL or BIP-353", lnurl());

            const fetchResults = await Promise.allSettled([
                (() => {
                    return new Promise<string>(async (resolve, reject) => {
                        const timeout = setTimeout(
                            () => reject(new Error(t("timeout"))),
                            invoiceFetchTimeout,
                        );

                        try {
                            const res = await fetchLnurl(
                                lnurl(),
                                Number(receiveAmount()),
                            );
                            resolve(res);
                        } catch (e) {
                            log.warn("Fetching invoice for LNURL failed:", e);
                            reject(new Error(formatError(e)));
                        } finally {
                            clearTimeout(timeout);
                        }
                    });
                })(),
                (() => {
                    return new Promise<string>(async (resolve, reject) => {
                        const timeout = setTimeout(
                            () => reject(new Error(t("timeout"))),
                            invoiceFetchTimeout,
                        );

                        try {
                            const res = await fetchBip353(
                                lnurl(),
                                Number(receiveAmount()),
                            );
                            resolve(res);
                        } catch (e) {
                            log.warn(
                                "Fetching invoice from BIP-353 failed:",
                                e,
                            );
                            reject(new Error(formatError(e)));
                        } finally {
                            clearTimeout(timeout);
                        }
                    });
                })(),
            ]);

            const fetched = fetchResults.find(
                (res) => res.status === "fulfilled",
            );
            if (fetched !== undefined) {
                setInvoice(fetched.value);
                setLnurl("");
                setInvoiceValid(true);
            } else {
                // All failed, so we can safely cast the first one
                notify(
                    "error",
                    (fetchResults[0] as PromiseRejectedResult).reason,
                );
                return;
            }
        } else {
            log.info("Fetching invoice from bolt12 offer", bolt12Offer());
            try {
                const res = await fetchBolt12Invoice(
                    bolt12Offer(),
                    Number(receiveAmount()),
                );
                setInvoice(res.invoice);
                setBolt12Offer(undefined);
                setInvoiceValid(true);
            } catch (e) {
                notify("error", formatError(e));
                log.warn("Fetching invoice from bol12 failed", e);
                return;
            }
        }
    };

    const buttonClick = async () => {
        setButtonDisable(true);
        setLoading(true);
        try {
            if (validWayToFetchInvoice()) {
                await fetchInvoice();
            }

            const { useRif, claimAddress } = await getClaimAddress(
                assetReceive,
                signer,
                onchainAddress,
            );

            if (!valid()) return;

            await createSwap(
                navigate,
                t,
                notify,
                newKey,
                deriveKey,
                ref,
                rescueFileBackupDone,
                pairs,
                swapType,
                assetSend,
                assetReceive,
                sendAmount,
                receiveAmount,
                invoice,
                signer,
                providers,
                getEtherSwap,
                hasBrowserWallet,
                claimAddress,
                useRif,
                setPairs,
                setInvoice,
                setInvoiceValid,
                setOnchainAddress,
                setAddressValid,
                setSwapStorage,
            );
        } catch (e) {
            log.error("Error creating swap", e);
            notify("error", e);
        } finally {
            setButtonDisable(false);
            setLoading(false);
        }
    };

    const getButtonLabel = (label: ButtonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            data-testid="create-swap-button"
            class={buttonClass()}
            disabled={
                !online() ||
                !(valid() || validWayToFetchInvoice()) ||
                buttonDisable()
            }
            onClick={buttonClick}>
            {loading() ? (
                <LoadingSpinner class="inner-spinner" />
            ) : (
                getButtonLabel(buttonLabel())
            )}
        </button>
    );
};

export default CreateButton;
