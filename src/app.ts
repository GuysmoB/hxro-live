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
let inLong = false;
let inShort = false;
let looseInc = 0;
let looseInc2 = 0;
let countdown: any;
let ohlc_tmp: any;
let ohlc: any;
let haOhlc: any;
let streamData: any;
let telegramBot: any;
let earlyPush = false;
const toDataBase = true;
const WebSocket = require("ws");

class App extends CandleAbstract {
  constructor(
    private utils: UtilsService,
    private stratService: StrategiesService,
    private config: Config,
    private indicators: IndicatorsService
  ) {
    super();
    firebase.initializeApp(config.firebaseConfig);
    telegramBot = new TelegramBot(config.token, { polling: false });

    ohlc = [];
    haOhlc = [];
    this.getStreamData("wss://btc.data.hxro.io/live");
    this.main();
  }



  /**
   * Gère la création des candles et de la logique principale..
   */
  async main() {
    const allData = await this.utils.getDataFromApi();
    ohlc = allData.data.slice();

    setInterval(() => {
      countdown = new Date().getSeconds();
      //console.log("second", countdown);

      if (countdown == 55) {
        if (ohlc_tmp) {
          ohlc_tmp.close = streamData.price;
          ohlc.push(ohlc_tmp);
          earlyPush = true;
          //console.log("ohlc 55 pushed", ohlc.length);
          this.findSetupOnClosedCandles();
        }
      }

      if (countdown == 0) {
        if (earlyPush) {
          ohlc.pop();
          earlyPush = false;
          //console.log("ohlc 55 pop", ohlc.length);
        }

        if (ohlc_tmp) {
          ohlc_tmp.close = streamData.price;
          ohlc.push(ohlc_tmp);
          //console.log("ohlc pushed", ohlc[ohlc.length - 1]);
        }

        ohlc_tmp = {
          time: streamData.ts,
          open: streamData.price,
          high: streamData.price,
          low: streamData.price,
        };
      }
    }, 1000);
  }


  /**
   * Ecoute le WS et ajuste high/low à chaque tick.
   */
  getStreamData(url: string) {
    let ws = new WebSocket(url);
    ws.onopen = function () {
      console.log("Socket is connected");
    }

    ws.onmessage = function (event: any) {
      streamData = JSON.parse(event.data);

      if (ohlc_tmp) {
        if (streamData.price > ohlc_tmp.high) {
          ohlc_tmp.high = streamData.price;
        }
        if (streamData.price < ohlc_tmp.low) {
          ohlc_tmp.low = streamData.price;
        }
      }
    };

    ws.onclose = function (e) {
      console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
      setTimeout(function () {
        this.getStreamData();
      }, 1000);
      this.sendTelegramMsg(telegramBot, this.config.chatId, 'Socket is closed');
    };

    ws.onerror = function (err) {
      console.error('Socket encountered error: ', err.message, 'Closing socket');
      ws.close();
    };
  }

  /**
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  findSetupOnClosedCandles() {
    try {
      const i = ohlc.length - 1;
      haOhlc = this.utils.setHeikenAshiData(ohlc);
      const rsiValues = this.indicators.rsi(ohlc, 14);

      if (inLong) {
        if (this.isUp(ohlc, i, 0)) {
          allTrades.push(this.utils.addFees(0.91));
          winTrades.push(this.utils.addFees(0.91));
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(allTrades), 2), this.utils.getDate());
          looseInc = 0;
        } else {
          allTrades.push(-1);
          loseTrades.push(-1);
          console.log('Resultat --', this.utils.round(this.utils.arraySum(allTrades), 2), this.utils.getDate());
          looseInc++;
        }

        if (this.stopConditions(i)) {
          inLong = false;
          looseInc = 0;
          console.log('Exit bull loose streak', this.utils.getDate());
        } else if (haOhlc[i].close < haOhlc[i].open) {
          inLong = false;
          looseInc = 0;
          console.log('Exit bull setup', this.utils.getDate());
        }

        if (toDataBase) {
          this.sendTelegramMsg(telegramBot, this.config.chatId, '---------------------------');
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Total trades : ' + (winTrades.length + loseTrades.length));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Total R:R : ' + (this.utils.round(loseTrades.reduce((a, b) => a + b, 0) + winTrades.reduce((a, b) => a + b, 0), 2)));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Avg R:R : ' + (this.utils.round(allTrades.reduce((a, b) => a + b, 0) / allTrades.length, 2)));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Winrate : ' + (this.utils.round((winTrades.length / (loseTrades.length + winTrades.length)) * 100, 2) + '%'));
          //this.utils.insertTrade(winTrades, loseTrades, allTrades);
        }
      }


      if (inShort) {
        if (!this.isUp(ohlc, i, 0)) {
          allTrades.push(this.utils.addFees(0.91));
          winTrades.push(this.utils.addFees(0.91));
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(allTrades), 2), this.utils.getDate());
          looseInc2 = 0;
        } else {
          allTrades.push(-1);
          loseTrades.push(-1);
          console.log('Resultat --', this.utils.round(this.utils.arraySum(allTrades), 2), this.utils.getDate());
          looseInc2++;
        }

        if (this.stopConditions(i)) {
          inShort = false;
          looseInc2 = 0;
          console.log('Exit short loose streak', this.utils.getDate());
        } else if (haOhlc[i].close > haOhlc[i].open) {
          inShort = false;
          looseInc2 = 0;
          console.log('Exit short setup', this.utils.getDate());
        }

        if (toDataBase) {
          this.sendTelegramMsg(telegramBot, this.config.chatId, '---------------------------');
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Total trades : ' + (winTrades.length + loseTrades.length));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Total R:R : ' + (this.utils.round(loseTrades.reduce((a, b) => a + b, 0) + winTrades.reduce((a, b) => a + b, 0), 2)));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Avg R:R : ' + (this.utils.round(allTrades.reduce((a, b) => a + b, 0) / allTrades.length, 2)));
          this.sendTelegramMsg(telegramBot, this.config.chatId, 'Winrate : ' + (this.utils.round((winTrades.length / (loseTrades.length + winTrades.length)) * 100, 2) + '%'));
          //this.utils.insertTrade(winTrades, loseTrades, allTrades);
        }
      }

      const lookback = 6;
      if (this.stratService.bullStrategy(haOhlc, i, lookback, rsiValues)) {
        inLong = true;
      } else if (this.stratService.bearStrategy(haOhlc, i, lookback, rsiValues)) {
        inShort = true;
      }
    } catch (error) {
      console.error(error);
      this.utils.stopProcess();
    }
  }

  /**
   * Envoie une notification à Télégram.
   */
  sendTelegramMsg(telegramBotObject: any, chatId: string, msg: string) {
    try {
      telegramBotObject.sendMessage(chatId, msg);
    } catch (err) {
      console.log(
        "Something went wrong when trying to send a Telegram notification",
        err
      );
    }
  }

  stopConditions(i: number): boolean {
    return (
      looseInc == 5 ||
      looseInc2 == 5 ||
      Math.abs(this.high(ohlc, i, 0) - this.low(ohlc, i, 0)) > 80
    ) ? true : false;
  }



}

const utilsService = new UtilsService();
new App(
  utilsService,
  new StrategiesService(utilsService),
  new Config(),
  new IndicatorsService(utilsService)
);
