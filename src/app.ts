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
import { IndicatorsService } from './services/indicators.service';

class App extends CandleAbstract {

  isSpot: false;
  obStream: any;
  snapshot: any;
  tmpBuffer = [];
  ohlc = [];
  telegramBot: any;
  urlPath = 'https://btc.history.hxro.io/1m';
  databasePath = '/orderbook-data-trade';
  toDatabase = true;
  token = 'b15346f6544b4d289139b2feba668b20';

  constructor(private utils: UtilsService, private config: Config, private apiService: ApiService, private indicators: IndicatorsService) {
    super();
    process.title = 'orderbook-data-trade';
    console.log('App started |', utils.getDate());
    firebase.initializeApp(config.firebaseConfig);
    this.telegramBot = new TelegramBot(config.token, { polling: false });

    if (this.isSpot) {
      this.getObStreamData('wss://stream.binance.com:9443/ws/btcusdt@depth@1000ms'); //spot
    } else {
      this.getObStreamData('wss://fstream.binance.com/stream?streams=btcusdt@depth'); //futurs
    }
    this.main();
  }


  /**
   * logique principale..
   */
  async main() {
    let lastTime: number;

    setInterval(async () => {
      let second = new Date().getSeconds();
      if (second == 50 && second != lastTime) {
        this.manageOb();
      }

      lastTime = second;
    }, 500);
  }

  /**
   * MAJ de l'ob.
   */
  async manageOb() {
    const obRes = this.utils.getBidAskFromBuffer(this.tmpBuffer, this.isSpot);
    this.tmpBuffer = [];

    this.snapshot.bids = this.utils.obUpdate(obRes.bids, this.snapshot.bids);
    this.snapshot.asks = this.utils.obUpdate(obRes.asks, this.snapshot.asks);
    this.snapshot.bids.sort((a, b) => b[0] - a[0]);
    this.snapshot.asks.sort((a, b) => a[0] - b[0]);

    /* const res0p25 = this.utils.getVolumeDepth(this.snapshot, 0.25);
    const res0p5 = this.utils.getVolumeDepth(this.snapshot, 0.5); */
    const res1 = this.utils.getVolumeDepth(this.snapshot, 1);
    /* const res2p5 = this.utils.getVolumeDepth(this.snapshot, 2.5);
    const ratio0p25 = this.utils.round((delta0p25 / (res0p25.bidVolume + res0p25.askVolume)) * 100, 2);
    const ratio0p5 = this.utils.round((delta0p5 / (res0p5.bidVolume + res0p5.askVolume)) * 100, 2); */
    const ratio1 = this.utils.round(((res1.bidVolume - res1.askVolume) / (res1.bidVolume + res1.askVolume)) * 100, 2);
    /* const ratio2p5 = this.utils.round((delta2p5 / (res2p5.bidVolume + res2p5.askVolume)) * 100, 2); */
    
    try {
      const allData = await this.apiService.getDataFromApi(this.urlPath);
      const res = allData.data.slice();
      const lastCandle = res[res.length - 2];
      
      this.ohlc.push({
        close: lastCandle.close,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        time: lastCandle.time,
        ratio1,
      });

      console.log(
        `------   ${this.utils.getDate()}  ------\n`+
        `Depth    1% | Ratio% :  ${ratio1}\n`+
        `Snapshot bids size :  ${this.snapshot.bids.length}\n`+
        `Snapshot asks size :  ${this.snapshot.asks.length}\n`
      ); 

      //this.toDatabase ? await firebase.database().ref(this.databasePath).push(this.ohlc[this.ohlc.length - 1]) : '';
      if (this.toDatabase) {
        await firebase.database().ref(this.databasePath).remove();
        await firebase.database().ref(this.databasePath).push(ratio1);
      } 
    } catch (error) {
      console.error('error Firebase : ' + error);
    }
  }



  /**
   * Ecoute le WS et ajuste high/low à chaque tick.
   */
  async getObStreamData(url: string) {
    this.snapshot = await this.apiService.getObSnapshot(this.isSpot);
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
  new ApiService(utilsService),
  new IndicatorsService(utilsService),
);
