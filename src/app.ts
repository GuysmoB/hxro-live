// https://www.digitalocean.com/community/tutorials/setting-up-a-node-project-with-typescript
// https://github.com/nikvdp/pidcrypt/issues/5#issuecomment-511383690
// https://github.com/Microsoft/TypeScript/issues/17645#issuecomment-320556012

process.env.NTBA_FIX_319 = "1"; // disable Telegram error
import { ApiService } from './services/api.service';
import { CandleAbstract } from "./abstract/candleAbstract";
import { UtilsService } from "./services/utils-service";
import { Config } from "./config";
import firebase from "firebase";
import TelegramBot from "node-telegram-bot-api";
import WebSocket from "ws";

class App extends CandleAbstract {

  obStream: any;
  snapshot: any;
  tmpBuffer = [];
  telegramBot: any;
  urlPath = 'https://btc.history.hxro.io/1m';
  databasePath = '/orderbook-data';
  toDatabase = false;
  token = 'b15346f6544b4d289139b2feba668b20';

  constructor(private utils: UtilsService, private config: Config, private apiService: ApiService) {
    super();
    process.title = 'orderbook-data';
    console.log('App started |', utils.getDate());
    firebase.initializeApp(config.firebaseConfig);
    this.telegramBot = new TelegramBot(config.token, { polling: false });
    //this.getObStreamData('wss://stream.binance.com:9443/ws/btcusdt@depth@1000ms'); //spot
    this.getObStreamData('wss://fstream.binance.com/stream?streams=btcusdt@depth'); //futurs
    this.main();
  }


  /**
   * logique principale..
   */
  async main() {
    let lastTime: number;

    setInterval(async () => {
      let second = new Date().getSeconds();
      if (second == 0 && second != lastTime) {
        this.manageOb();
      }

      lastTime = second;
    }, 500);
  }

  /**
   * MAJ de l'ob.
   */
  async manageOb() {
    const obRes = this.utils.getBidAskFromBuffer(this.tmpBuffer);
    this.tmpBuffer = [];

    this.snapshot.bids = this.utils.obUpdate(obRes.bids, this.snapshot.bids);
    this.snapshot.asks = this.utils.obUpdate(obRes.asks, this.snapshot.asks);
    this.snapshot.bids.sort((a, b) => b[0] - a[0]);
    this.snapshot.asks.sort((a, b) => a[0] - b[0]);

    const resp025 = this.utils.getVolumeDepth(this.snapshot, 0.25);
    const resp05 = this.utils.getVolumeDepth(this.snapshot, 0.5);
    const res1 = this.utils.getVolumeDepth(this.snapshot, 1);
    const res2p5 = this.utils.getVolumeDepth(this.snapshot, 2.5);
    const deltap025 = this.utils.round(resp025.bidVolume - resp025.askVolume, 2);
    const deltap05 = this.utils.round(resp05.bidVolume - resp05.askVolume, 2);
    const delta1 = this.utils.round(res1.bidVolume - res1.askVolume, 2);
    const delta2p5 = this.utils.round(res2p5.bidVolume - res2p5.askVolume, 2);
    const ratiop025 = this.utils.round((deltap025 / (resp025.bidVolume + resp025.askVolume)) * 100, 2);
    const ratiop05 = this.utils.round((deltap05 / (resp05.bidVolume + resp05.askVolume)) * 100, 2);
    const ratio1 = this.utils.round((delta1 / (res1.bidVolume + res1.askVolume)) * 100, 2);
    const ratio2p5 = this.utils.round((delta2p5 / (res2p5.bidVolume + res2p5.askVolume)) * 100, 2);

    console.log(
      '------ ' + this.utils.getDate() + ' ------\n' +
      'Depth  2.5% | Ratio% : ' + ratio2p5 + '\n' +
      'Depth    1% | Ratio% : ' + ratio1 + '\n'+
      'Depth  0.5% | Ratio% : ' + ratiop05 + '\n'+
      'Depth 0.25% | Ratio% : ' + ratiop025 + '\n'+
      'Snapshot bids size : '+ this.snapshot.bids.length+ '\n' +
      'Snapshot asks size : '+ this.snapshot.asks.length+ '\n'
    );

    try {
      setTimeout(async () => {
        const allData = await this.apiService.getDataFromApi(this.urlPath);
        const res = allData.data.slice();
        const lastCandle = res[res.length - 2];
    
        this.toDatabase ? await firebase.database().ref(this.databasePath).push({
          close: lastCandle.close,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          time: lastCandle.time,
          ratiop025: ratiop025,
          ratiop05: ratiop05,
          ratio1: ratio1,
          ratio2p5: ratio2p5
        }) : '';
      }, 10*1000);
    } catch (error) {
      console.error('error Firebase : ' + error);
    }
  }



  /**
   * Ecoute le WS et ajuste high/low à chaque tick.
   */
  async getObStreamData(url: string) {
    this.snapshot = await this.apiService.getObSnapshot();
    this.snapshot.bids = this.utils.convertArrayToNumber(this.snapshot.bids);
    this.snapshot.asks = this.utils.convertArrayToNumber(this.snapshot.asks);
    let ws = new WebSocket(url);
    const _this = this;

    ws.onopen = function () {
      console.log("Socket is connected. Listenning data ...");
    }

    ws.onmessage = function (event: any) {
      _this.tmpBuffer.push(JSON.parse(event.data));
    };

    ws.onclose = function (e) {
      console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
      setTimeout(function () {
        _this.getObStreamData(url);
      }, 1000);
      _this.sendTelegramMsg(_this.telegramBot, _this.config.chatId, 'Reconnecting ...');
    };

    ws.onerror = function (err: any) {
      console.error('Socket encountered error: ', err.message, 'Closing socket');
      ws.close();
    };
  }

  /**
   * Envoie une notification à Télégram.
   */
  sendTelegramMsg(telegramBotObject: any, chatId: string, msg: string) {
    try {
      telegramBotObject.sendMessage(chatId, msg);
    } catch (err) {
      console.log("Something went wrong when trying to send a Telegram notification", err);
    }
  }

}

const utilsService = new UtilsService();
new App(
  utilsService,
  new Config(),
  new ApiService(utilsService)
);
