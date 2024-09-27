# SwapMarket

This is a fork of the official Boltz Web App served at [boltz.exchange](https://boltz.exchange/), which allows non-custodial swaps between different layers of Bitcoin. It adds the ability to list third parties' backend APIs in addition to Boltz's, so that a user can get a better deal. 

Any node can now run [boltz-backend](https://github.com/BoltzExchange/boltz-backend) and compete with Boltz at [SwapMarket](https://swapmarket.github.io).

In addition to potentially lower costs, executing Bitcoin swaps via SwapMarket reduces centralization in this domain and helps avert regulatory pressure on Boltz.

## Is this legal?

Boltz's [AGPL-3.0 license](https://github.com/BoltzExchange/boltz-web-app/blob/main/LICENSE) permits modifying and running its source code as long as it remains public.

## Is this safe?

Running a web app at Github Pages has an advantage of transparency. The code is hosted, built and deployed publicly. What you see is what you get. Anyone can verify [attestation](https://github.com/SwapMarket/swapmarket.github.io/attestations) commit hash against the main branch. This is more transparent than the Boltz exchange itself.

All the swaps are atomic. This means both legs will settle, or none at all. Your keys never leave your wallet, which makes the exchange non-custodial.

## Onboarding

Nodes aspiring to become swap providers can apply via [email](mailto:swapmarket.wizard996@passinbox.com) or by adding their API details to the [config file](https://github.com/SwapMarket/swapmarket.github.io/blob/main/src/configs/mainnet.json) with a PR. It is obligatory to be contactable and have ample liquidity. 

Consult Boltz's [deployment instructions](https://github.com/BoltzExchange/boltz-backend/blob/master/docs/deployment.md). It is easier to start with the [Testnet mirror](https://swapmarket.github.io/testnet) and your local backend listening on 127.0.0.1:9001.

When running the API backend, it is crucial to regularly update swapMaximal amounts in your boltz.conf to reflect changes in liquidity. 

## Resources

* Read the Docs: [Docs Home](https://docs.boltz.exchange/)
