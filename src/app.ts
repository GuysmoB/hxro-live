import { ApiService } from './services/api.service';
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
import WebSocket from "ws";

class App extends CandleAbstract {

  winTrades = [];
  loseTrades = [];
  inLong = false;
  inShort = false;
  looseInc = 0;
  looseInc2 = 0;
  countdown: any;
  ohlc_tmp: any;
  ohlc = [];
  haOhlc = [];
  streamData: any;
  telegramBot: any;
  toDataBase = false;
  isCountDownSnipe = false;
  isCountDown0 = false;
  isCountDown55 = false;
  token = 'b15346f6544b4d289139b2feba668b20';
  url = 'wss://btc.data.hxro.io/live';

  constructor(private utils: UtilsService, private stratService: StrategiesService, private config: Config,
    private indicators: IndicatorsService, private apiService: ApiService) {
    super();
    firebase.initializeApp(config.firebaseConfig);
    this.telegramBot = new TelegramBot(config.token, { polling: false });

    this.getStreamData(this.url);
    this.main();
  }



  /**
   * Gère la création des candles et de la logique principale..
   */
  async main() {
    //const seriesId = await this.apiService.getSeriesId(this.token);
    //this.apiService.getContestId(this.token, seriesId);
    //this.apiService.getContestsBySeriesId(seriesId);
    //this.apiService.getRunningContestSeries();

    const _this = this;

    setInterval(async () => {
      this.countdown = new Date().getSeconds();

      if (this.countdown == 10) {
        (this.isCountDown0) ? this.isCountDown0 = false : '';
        (this.isCountDown55) ? this.isCountDown55 = false : '';
      }

      if (this.countdown == 55 && !this.isCountDown55) {
        this.isCountDown55 = true;
        if (this.ohlc_tmp) {
          this.ohlc_tmp.close = this.streamData.price;
          this.ohlc.push(this.ohlc_tmp);
          //this.findSetupOnClosedCandles();     // real money
        }
      }

      if (this.countdown == 1 && !this.isCountDown0) {
        this.isCountDown0 = true;
        const allData = await _this.apiService.getDataFromApi();
        this.ohlc = allData.data.slice();

        this.findSetupOnClosedCandles(); // fake money
        this.ohlc_tmp = {
          time: this.streamData.ts,
          open: this.streamData.price,
          high: this.streamData.price,
          low: this.streamData.price,
        };
      }



    }, 500);
  }


  /**
   * Ecoute le WS et ajuste high/low à chaque tick.
   */
  getStreamData(url: string) {
    let ws = new WebSocket(url);
    const _this = this;

    ws.onopen = function () {
      console.log("Socket is connected. Listenning data ...");
    }

    ws.onmessage = function (event: any) {
      _this.streamData = JSON.parse(event.data);

      if (_this.ohlc_tmp) {
        if (_this.streamData.price > _this.ohlc_tmp.high) {
          _this.ohlc_tmp.high = _this.streamData.price;
        }
        if (_this.streamData.price < _this.ohlc_tmp.low) {
          _this.ohlc_tmp.low = _this.streamData.price;
        }
      }
    };

    ws.onclose = function (e) {
      console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
      setTimeout(function () {
        _this.getStreamData(_this.url);
      }, 1000);
      _this.sendTelegramMsg(_this.telegramBot, _this.config.chatId, 'Reconnecting ...');
    };

    ws.onerror = function (err: any) {
      console.error('Socket encountered error: ', err.message, 'Closing socket');
      ws.close();
    };
  }

  /**
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  findSetupOnClosedCandles() {
    try {
      const i = this.ohlc.length - 1;
      this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);
      const rsiValues = this.indicators.rsi(this.ohlc, 14);

      if (this.inLong && this.inShort) {
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, '### Long and Short ###');
      }

      if (this.inLong) {
        if (this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.utils.addFees(0.91));
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(0.91)) : '';
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
          this.looseInc = 0;
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(-1)) : '';
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
          this.looseInc++;
        }

        if (this.stopConditions(i)) {
          this.inLong = false;
          this.looseInc = 0;
          console.log('Exit bull loose streak', this.utils.getDate());
        } else if (this.haOhlc[i].close < this.haOhlc[i].open) {
          this.inLong = false;
          this.looseInc = 0;
          console.log('Exit bull setup', this.utils.getDate());
        }
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }



      else if (this.inShort) {
        if (!this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.utils.addFees(0.91));
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(0.91)) : '';
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
          this.looseInc2 = 0;
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(-1)) : '';
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
          this.looseInc2++;
        }

        if (this.stopConditions(i)) {
          this.inShort = false;
          this.looseInc2 = 0;
          console.log('Exit short loose streak', this.utils.getDate());
        } else if (this.haOhlc[i].close > this.haOhlc[i].open) {
          this.inShort = false;
          this.looseInc2 = 0;
          console.log('Exit short setup', this.utils.getDate());
        }
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }


      const lookback = 1;
      if (this.stratService.bullStrategy(this.haOhlc, i, lookback, rsiValues)) {
        this.inLong = true;
      } else if (this.stratService.bearStrategy(this.haOhlc, i, lookback, rsiValues)) {
        this.inShort = true;
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

  formatTelegramMsg() {
    return 'Total trades : ' + (this.winTrades.length + this.loseTrades.length) + '\n' +
      'Total R:R : ' + (this.utils.round(this.loseTrades.reduce((a, b) => a + b, 0) + this.winTrades.reduce((a, b) => a + b, 0), 2)) + '\n' +
      'Winrate : ' + (this.utils.round((this.winTrades.length / (this.loseTrades.length + this.winTrades.length)) * 100, 2) + '%');
  }

  stopConditions(i: number): boolean {
    return (
      this.looseInc == 5 ||
      this.looseInc2 == 5 ||
      Math.abs(this.high(this.ohlc, i, 0) - this.low(this.ohlc, i, 0)) > 80
    ) ? true : false;
  }



}

const utilsService = new UtilsService();
new App(
  utilsService,
  new StrategiesService(utilsService),
  new Config(),
  new IndicatorsService(utilsService),
  new ApiService()
);
