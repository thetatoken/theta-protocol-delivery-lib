'use strict';

const PEER_SERVER_HOST = "prod-theta-peerjs.thetatoken.org";
const PEER_SERVER_PORT = 8700;
const TRACKER_SERVER_HOST = "prod-testnet-grouping.thetatoken.org";
const TRACKER_SERVER_PORT = 8700;

const PLATFORM_THETA_WALLET_SERVICE_URL = "https://api-wallet-service.thetatoken.org/theta";

// TODO Fill these in with your data
const VIDEO_ID = 'vid123';
const VIDEO_URL = "https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8";


// --------- Guest User Helpers ------------

function generateGuestUserIdIfNeeded() {
    let guestUserId = localStorage.getItem("THETA_EXAMPLE_GUEST_USER_ID");
    if (guestUserId === null) {
        var guestID = "" + (new Date().getTime());
        localStorage.setItem("THETA_EXAMPLE_GUEST_USER_ID", guestID);
    }
}

function getGuestUserId() {
    return localStorage.getItem("THETA_EXAMPLE_GUEST_USER_ID")
}

// --------- Platform Theta Wallet ------------

class PlatformThetaWalletService extends Theta.BaseWallet {
    async getWalletAccessToken() {
        let headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Guest-User': getGuestUserId()
        };

        const settings = {
            method: 'POST',
            headers: headers
        };

        //TODO This is a sample endpoint to auth your user; however, you will implement your own endpoint to generate a signed JWT
        // in order to authenticate your own users' transaction (please contact us to get a testnet API Key / Secret Key & Docs)
        let url = "https://api.sliver.tv/v1/theta/vault/token";
        let response = await fetch(url, settings);
        let responseData = await response.json();
        let body = responseData["body"];
        let accessToken = body["access_token"];

        return accessToken;
    }

    async _makeRPC(name, args) {
        let self = this;

        let data = {
            "jsonrpc": "2.0",
            "method": name,
            "params": [args],
            "id": "1"
        };

        let accessToken = await this.getWalletAccessToken();
        if (accessToken === null) {
            //Try again...
            setTimeout(function () {
                console.log("trying again...");
                self._makeRPC(name, args);
            }, 1000);
            return;
        }

        return new Promise((resolve, reject) => {
            let headers = {'Content-Type': 'application/json'};
            headers["x-access-token"] = accessToken;

            $.ajax({
                url: "https://api-wallet-service.thetatoken.org/theta",
                data: JSON.stringify(data),
                type: 'POST',
                headers: headers
            }).done((resp) => {
                if (resp.error) {
                    reject(resp.error);
                } else {
                    resolve(resp.result);
                }
            }).fail((resp) => {
                reject(resp);
            });
        });
    }
}


// --------- Launch the App --------- 

function startVideo(theta) {
    class ClosuredThetaLoader extends Theta.HlsJsFragmentLoader {
        load(...args) {
            // Inject context from closure.
            this.thetaCtx = theta;
            super.load(...args);
        }
    }

    let hlsOpts = (theta ? {fLoader: ClosuredThetaLoader} : {});
    let videoURL = VIDEO_URL;
    let videoElement = document.getElementById('player');

    if (Hls.isSupported()) {
        let hls = new Hls(hlsOpts);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MEDIA_ATTACHED, function () {
            // load the stream
            hls.loadSource(videoURL);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            // Start playback
            videoElement.play();
        });
    }
    else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // hls.js is not supported on platforms that do not have Media Source
        // Extensions (MSE) enabled. When the browser has built-in HLS support
        // (check using `canPlayType`), we can provide an HLS manifest (i.e. .m3u8 URL)
        // directly to the video element throught the `src` property. This is using the
        // built-in support of the plain video element, without using hls.js.
        // Note: it would be more normal to wait on the 'canplay' event below however on
        // Safari (where you are most likely to find built-in HLS support) the video.src
        // URL must be on the user-driven. White-list before a 'canplay' event will be emitted;
        // the last video event that can be reliably listened-for when the URL is not on
        // the white-list is 'loadedmetadata'.

        // We are not using HLS.js, so Theta will not be able to use P2P!
        videoElement.src = videoURL;
        videoElement.addEventListener('loadedmetadata', function () {
            videoElement.play();
        });
    }
    else {
        // No HLS is supported...fallback...
    }
}

function startPlayer() {
    let userId = getGuestUserId();

    let wallet = new PlatformThetaWalletService({
        endpoint: PLATFORM_THETA_WALLET_SERVICE_URL
    });
    wallet.start();

    let theta = new Theta({
        //TODO adjust params as needed depending on your HLS settings
        fragmentSize: 5000,
        failoverFactor: 0.7,
        fragmentTimeout: 3000,
        probeTimeout: 600,
        statsReportInterval: 90000,
        peerReqInterval: 120000,

        videoId: VIDEO_ID,
        userId: userId,
        wallet: wallet,

        peerServer: {
            host: PEER_SERVER_HOST,
            port: PEER_SERVER_PORT,
            secure: true
        },
        trackerServer: {
            host: TRACKER_SERVER_HOST,
            port: TRACKER_SERVER_PORT,
            secure: true,
            path: ""
        },

        debug: true
    });

    // Event handlers
    theta.addEventListener(Theta.Events.PEERS_CHANGED, function (data) {
        // Connected peers changed
        // Data:
        // totalPeers : Integer
    });
    theta.addEventListener(Theta.Events.TRAFFIC, function (data) {
        // Bandwidth was used
        // Data:
        // type : String ('cdn', 'p2p_inbound', 'p2p_outbound')
        // stats : Object
        // stats.size : Integer - Total bytes
    });
    theta.addEventListener(Theta.Events.PAYMENT_RECEIVED, function (data) {
        // Payment received
        // Data:
        // payment : Object - info about the payment
        // payment.amount : Integer - Payment amount in GammaWei
    });
    theta.addEventListener(Theta.Events.PAYMENT_SENT, function (data) {
        // Payment sent
        // Data:
        // payment : Object - info about the payment
        // payment.amount : Integer - Payment amount in GammaWei
    });
    theta.addEventListener(Theta.Events.ACCOUNT_UPDATED, function (data) {
        // Account/waller updated
        // Data:
        // account : Object - info about the account/wallet
    });
    theta.start();

    //If you are using the Theta widget, connect the widget so it can listen to events
    theta.connectWidget();

    startVideo(theta);
}

function startApp() {
    generateGuestUserIdIfNeeded();
    startPlayer();
}