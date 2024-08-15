import log from "loglevel";

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    discordUrl: "https://discord.gg/QBvZGcW",
    twitterUrl: "https://twitter.com/boltzhq",
    githubUrl: "https://github.com/BoltzExchange",
    repoUrl: "https://github.com/BoltzExchange/boltz-web-app",
    docsUrl: "https://docs.boltz.exchange",
    blogUrl: "https://blog.boltz.exchange/archive",
    nostrUrl:
        "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970",
    statusUrl: "https://status.boltz.exchange",
    youtubeUrl:
        "https://www.youtube.com/playlist?list=PLkqOa9SGBeZfAEHvKkGKjeRIASeu6bNO3",
    brandingUrl: "https://github.com/BoltzExchange/logo",
    testnetUrl: "https://testnet.boltz.exchange",
    canaryUrl: "https://canary.boltz.exchange",
    telegramUrl: "https://t.me/boltzhq",
    email: "hi@bol.tz",
};

type Asset = {
    network?: any;
    blockExplorerUrl?: Url;

    rifRelay?: string;
    contracts?: {
        deployHeight: number;
        smartWalletFactory?: string;
        deployVerifier?: string;
    };
};

type Url = {
    normal: string;
    tor?: string;
};

export type Config = {
    // The wsFallback is used on regtest when the backend is being run without
    // nginx and the WebSocket is on a different port than the rest of the API
    apiUrl?: Url & { wsFallback?: string };
    network?: "mainnet" | "testnet" | "regtest";
    isBoltzClient?: boolean;
    boltzClientApiUrl?: string;
    isBeta?: boolean;
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

let config: Config = defaults;

const isTor = () => window?.location.hostname.endsWith(".onion");

export const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

export const setConfig = (data: any) => {
    config = { ...defaults, ...data };
    log.setLevel(config.loglevel!);
};

export { config };
