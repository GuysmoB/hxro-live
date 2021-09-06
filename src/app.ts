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
import * as fs from 'fs';


class App extends CandleAbstract {

  obStream: any;
  snapshot: any;
  tmpBuffer = [];
  telegramBot: any;
  urlPath = 'https://btc.history.hxro.io/1m';
  databasePath = '/orderbook-data';
  toDatabase = true;
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

    const res1 = this.utils.getVolumeDepth(this.snapshot, 1);
    const res2p5 = this.utils.getVolumeDepth(this.snapshot, 2.5);
    const res5 = this.utils.getVolumeDepth(this.snapshot, 5);
    const res10 = this.utils.getVolumeDepth(this.snapshot, 10);
    const delta1 = this.utils.round(res1.bidVolume - res1.askVolume, 2);
    const delta2p5 = this.utils.round(res2p5.bidVolume - res2p5.askVolume, 2);
    const delta5 = this.utils.round(res5.bidVolume - res5.askVolume, 2);
    const delta10 = this.utils.round(res10.bidVolume - res10.askVolume, 2);
    const ratio1 = this.utils.round((delta1 / (res1.bidVolume + res1.askVolume)) * 100, 2);
    const ratio2p5 = this.utils.round((delta2p5 / (res2p5.bidVolume + res2p5.askVolume)) * 100, 2);
    const ratio5 = this.utils.round((delta5 / (res5.bidVolume + res5.askVolume)) * 100, 2);
    const ratio10 = this.utils.round((delta10 / (res10.bidVolume + res10.askVolume)) * 100, 2);

    /* const msg =
      '------ ' + this.utils.getDate() + ' ------\n' +
      'Depth  10% | Ratio% : ' + ratio10 + '\n' +
      'Depth   5% | Ratio% : ' + ratio5 + '\n' +
      'Depth 2.5% | Ratio% : ' + ratio2p5 + '\n' +
      'Depth   1% | Ratio% : ' + ratio1 + '\n';

    console.log(msg); */

    const allData = await this.apiService.getDataFromApi(this.urlPath);
    const res = allData.data.slice();
    const lastCandle = res[res.length - 2];
    lastCandle.ratio1 = ratio1;
    lastCandle.ratio2p5 = ratio2p5;
    lastCandle.ratio5 = ratio2p5;
    lastCandle.ratio10 = ratio10;
    try {
      await firebase.database().ref(this.databasePath).push({
        close: lastCandle.close,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        time: lastCandle.time,
        ratio1: ratio1,
        ratio2p5: ratio2p5,
        ratio5: ratio2p5,
        ratio10: ratio10
      });
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
