import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import { Accessor, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { getAddress, getNetwork } from "../utils/compat";
import { fetcher } from "../utils/helper";
import { decodeInvoice } from "../utils/invoice";
import { refund } from "../utils/refund";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ContractTransaction from "./ContractTransaction";

const RefundButton = ({ swap }: { swap: Accessor<Record<string, any>> }) => {
    const {
        setNotificationType,
        setNotification,
        swaps,
        setSwaps,
        setRefundAddress,
        refundAddress,
        setRefundTx,
        t,
    } = useGlobalContext();
    if (swap() && swap().asset === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        const updateSwaps = (cb: any) => {
            const swapsTmp = swaps();
            const currentSwap = swapsTmp.find((s) => swap().id === s.id);
            cb(currentSwap);
            setSwaps(swapsTmp);
        };

        return (
            <ContractTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();
                    const tx = await contract.refund(
                        prefix0x(decodeInvoice(swap().invoice).preimageHash),
                        satoshiToWei(swap().expectedAmount),
                        swap().claimAddress,
                        swap().timeoutBlockHeight,
                    );
                    updateSwaps((current: any) => (current.refundTx = tx.hash));
                    await tx.wait(1);
                }}
                buttonText={t("refund")}
            />
        );
    }

    const [valid, setValid] = createSignal<boolean>(false);

    const refundAddressChange = (evt: InputEvent, asset: string) => {
        const input = evt.currentTarget as HTMLInputElement;
        const inputValue = input.value.trim();
        try {
            getAddress(asset).toOutputScript(
                inputValue,
                getNetwork(asset) as LiquidNetwork,
            );
            input.setCustomValidity("");
            setRefundAddress(inputValue);
            return true;
        } catch (e) {
            log.debug("parsing refund address failed", e);
            input.setCustomValidity("invalid address");
        }

        return false;
    };

    const refundAction = async () => {
        try {
            const transactionToRefund = await fetcher(
                "/getswaptransaction",
                swap().asset,
                {
                    id: swap().id,
                },
            );
            log.debug(
                `got swap transaction for ${swap().id}`,
                transactionToRefund,
            );
            const res = await refund(
                swap(),
                refundAddress(),
                transactionToRefund,
            );

            // save refundTx into swaps json and set it to the current swap
            // only if the swaps was not initiated with the refund json
            // refundjson has no date
            if (res.date !== undefined) {
                const swapsTmp = swaps();
                const currentSwap = swapsTmp.find((s) => res.id === s.id);
                currentSwap.refundTx = res.refundTx;
                setSwaps(swapsTmp);
            } else {
                setRefundTx(res.refundTx);
            }
        } catch (error) {
            log.debug("refund failed", error);
            setNotificationType("error");
            if (typeof error.json === "function") {
                error
                    .json()
                    .then((jsonError: any) => {
                        let msg = jsonError.error;
                        if (
                            msg === "bad-txns-inputs-missingorspent" ||
                            msg === "Transaction already in block chain" ||
                            msg.startsWith("insufficient fee")
                        ) {
                            msg = t("already_refunded");
                        } else if (
                            msg === "mandatory-script-verify-flag-failed"
                        ) {
                            msg = t("locktime_not_satisfied");
                        }
                        log.error(msg);
                        setNotification(msg);
                    })
                    .catch((genericError: any) => {
                        log.error(genericError);
                        setNotification(genericError);
                    });
            } else {
                log.error(error.message);
                setNotification(error.message);
            }
        }
    };

    return (
        <>
            <input
                data-testid="refundAddress"
                id="refundAddress"
                disabled={swap() === null}
                onInput={(e) => setValid(refundAddressChange(e, swap()?.asset))}
                type="text"
                name="refundAddress"
                placeholder={t("refund_address_placeholder")}
            />
            <button
                data-testid="refundButton"
                class="btn"
                disabled={!valid()}
                onclick={() => refundAction()}>
                {t("refund")}
            </button>
        </>
    );
};

export default RefundButton;