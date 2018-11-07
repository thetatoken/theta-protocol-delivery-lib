'use strict';

const PEER_SERVER_HOST = "prod-theta-peerjs.thetatoken.org";
const PEER_SERVER_PORT = 8700;
const TRACKER_SERVER_HOST = "prod-testnet-grouping.thetatoken.org";
const TRACKER_SERVER_PORT = 8700;

const PLATFORM_THETA_WALLET_SERVICE_URL = "https://api-wallet-service.thetatoken.org/theta";

// TODO Fill these in with your data
const VIDEO_ID = 'vid123';
const LOGGED_IN_USER_ID = 'usr123';
const LOGGED_IN_USER_AUTH_TOKEN = 'tok123';
const VIDEO_URL = "https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8";

// --------- Platform Theta Wallet ------------

class PlatformThetaWalletService extends Theta.BaseWallet {
    getAuth() {
        let userId = LOGGED_IN_USER_ID;
        let authToken = LOGGED_IN_USER_AUTH_TOKEN;

        if (userId && authToken) {
            return {
                userId: userId,
                authToken: authToken
            }
        }
        else {
            // No user is logged in, don't call the server.
            return null;
        }
    }

    async _makeRPC(name, args) {
        let data = {
            "jsonrpc": "2.0",
            "method": name,
            "params": [args],
            "id": "1"
        };
        return new Promise((resolve, reject) => {
            let auth = this.getAuth();

            if(auth) {
                // Configure the API call to your server adding headers, auth, etc.
                $.ajax({
                    url: this.config.endpoint,
                    data: JSON.stringify(data),
                    type: 'POST',
                    headers: {
                        'X-Auth-User': auth.userId,
                        'X-Auth-Token': auth.authToken,
                        'Content-Type': 'application/json'
                    }
                })
                .done((resp) => {
                    if(resp.error) {
                        reject(resp.error);
                    } else {
                        resolve(resp.result);
                    }
                })
                .fail((resp) => {
                    reject(resp);
                });
            } else {
                // No user us logged in.
            }
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
    let userId = LOGGED_IN_USER_ID;

    let wallet = new PlatformThetaWalletService({
        endpoint: PLATFORM_THETA_WALLET_SERVICE_URL
    });
    wallet.start();

    let theta = new Theta({
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
    startPlayer();
}
