import { VsArrowSmallRight } from "solid-icons/vs";
import { Show } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { RecoverableSwap } from "../utils/boltzClient";
import { SomeSwap } from "../utils/swapCreator";

export const SwapIcons = (props: { swap: SomeSwap | RecoverableSwap }) => {
    return (
        <Show
            when={"assetSend" in props.swap}
            fallback={
                <span class="swaplist-asset">
                    <span data-asset={(props.swap as RecoverableSwap).symbol} />
                </span>
            }>
            <span class="swaplist-asset">
                <span
                    data-asset={
                        props.swap.type === SwapType.Reverse
                            ? LN
                            : (props.swap as SomeSwap).assetSend
                    }
                />
                <VsArrowSmallRight />
                <span
                    data-asset={
                        props.swap.type === SwapType.Submarine
                            ? LN
                            : (props.swap as SomeSwap).assetReceive
                    }
                />
            </span>
        </Show>
    );
};
