// https://www.digitalocean.com/community/tutorials/setting-up-a-node-project-with-typescript
// https://github.com/nikvdp/pidcrypt/issues/5#issuecomment-511383690
// https://github.com/Microsoft/TypeScript/issues/17645#issuecomment-320556012

process.env.NTBA_FIX_319 = "1"; // disable Telegram error
import { IndicatorsService } from "./services/indicators.service";
import { CandleAbstract } from "./abstract/candleAbstract";
import { StrategiesService } from "./services/strategies-service";
import { UtilsService } from "./services/utils-service";
import { Config } from "./config";
import firebase from "firebase";
import TelegramBot from "node-telegram-bot-api";

// VARIABLES
let winTrades = [];
let loseTrades = [];
let allTrades = [];
let countdown: any;
let ohlc_tmp: any;
let ohlc: any;
let timeProcessed: any;
let streamData: any;
let telegramBot: any;
let earlyPush = false;
const toDataBase = false;
const WebSocket = require("ws");
let socket = new WebSocket("wss://btc.data.hxro.io/live");
const events = require("events");
const lsEmitter = new events.EventEmitter();

class App extends CandleAbstract {
  constructor(
    private utils: UtilsService,
    private stratService: StrategiesService,
    private config: Config,
    private indicators: IndicatorsService
  ) {
    super();
    /* firebase.initializeApp(config.firebaseConfig);
    telegramBot = new TelegramBot(config.token, { polling: false }); */

    timeProcessed = [];
    ohlc = [];
    socket.onmessage = function (event: any) {
      lsEmitter.emit("update", JSON.parse(event.data));
    };


    setInterval(() => {
      countdown = this.utils.getSecondFromDate();
      console.log("second", countdown);

      if (countdown == 55) {
        if (ohlc_tmp) {
          ohlc_tmp.close = streamData.price;
          ohlc.push(ohlc_tmp);
          earlyPush = true;
          console.log("ohlc 55 pushed", ohlc.length);
          //this.findSetupOnClosedCandles("");
        }
      }
    }, 1000);

    this.init();
  }


  /**
   * Point d'entrée.
   * 
        to_sym: 'USD',
        from_sym: 'BTC',
        ts: 1626295563357,
        price: 32798.59,
        volume: 0
   */
  async init() {
    try {
      const allData = await this.utils.getDataFromApi();
      ohlc = allData.data.slice();

      lsEmitter.on("update", (stream: any) => {
        streamData = stream;
        const minuteTimestamp = Math.trunc(Date.now() / (60000 / 60));
        //const minuteTimestamp = Math.trunc(Date.now() / 60000);

        if (minuteTimestamp % 1 === 0 && !timeProcessed.find((element: any) => element === minuteTimestamp)) {
          timeProcessed.push(minuteTimestamp);
          //console.log("timeProcessed", timeProcessed);

          if (earlyPush) {
            ohlc.pop();
            earlyPush = false;
            console.log("ohlc 55 pop", ohlc.length);
          }

          if (ohlc_tmp) {
            ohlc_tmp.close = stream.price;
            ohlc.push(ohlc_tmp);
            //console.log("ohlc tmp", ohlc_tmp);
            console.log("ohlc pushed", ohlc[ohlc.length - 1]);
          }

          ohlc_tmp = {
            time: stream.ts,
            open: stream.price,
            high: stream.price,
            low: stream.price,
          };
          //console.log("ohlc tmp", ohlc_tmp);
        }

        if (ohlc_tmp) {
          let currentCandlestick = ohlc_tmp;
          if (stream.price > currentCandlestick.high) {
            currentCandlestick.high = stream.price;
          }
          if (stream.price < currentCandlestick.low) {
            currentCandlestick.low = stream.price;
          }
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  findSetupOnClosedCandles() {
    try {

    } catch (error) {
      console.error(error);
      this.utils.stopProcess();
    }
  }



  main() {
    (async () => {
      setInterval(() => {
        if (ohlc_tmp) {
          ohlc_tmp.close = streamData.price;
          ohlc.push(ohlc_tmp);
          //console.log("ohlc tmp", ohlc_tmp);
          console.log("ohlc pushed", ohlc);
        }

        ohlc_tmp = {
          date: streamData.ts,
          open: streamData.price,
          high: streamData.price,
          low: streamData.price,
        };

        if (ohlc_tmp) {
          let currentCandlestick = ohlc_tmp;
          if (streamData.price > currentCandlestick.high) {
            currentCandlestick.high = streamData.price;
          }
          if (streamData.price < currentCandlestick.low) {
            currentCandlestick.low = streamData.price;
          }
        }
      }, 1000);

    })();
  }

}

const utilsService = new UtilsService();
new App(
  utilsService,
  new StrategiesService(utilsService),
  new Config(),
  new IndicatorsService(utilsService)
);
