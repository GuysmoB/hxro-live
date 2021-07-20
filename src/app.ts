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
  inPosition = false;
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
    const _this = this;

    setInterval(async () => {
      this.countdown = new Date().getSeconds();
      //console.log('COuntdown', this.countdown)
      if (this.countdown == 5 || this.countdown == 20 || this.countdown == 35 || this.countdown == 50) {
        (this.isCountDownSnipe) ? this.isCountDownSnipe = false : '';
        //console.log('snipe bool', this.isCountDownSnipe)
      }

      if ((this.countdown == 0 || this.countdown == 15 || this.countdown == 30 || this.countdown == 45) && !this.isCountDownSnipe) {
        this.isCountDownSnipe = true;
        //console.log('snipe bool', this.isCountDownSnipe)

        if (this.ohlc_tmp) {
          this.ohlc_tmp.close = this.streamData.price;
          this.ohlc.push(this.ohlc_tmp);
          //console.log('pushed')

          if (this.countdown == 45 && !this.inPosition) {
            console.log('bullorBear');
            this.bullOrBear();
          }

          if (this.countdown == 0 && (this.inLong || this.inShort) && !this.inPosition) {
            console.log('InPosition');
            this.inPosition = true;
          } else if (this.countdown == 0 && this.inPosition) {
            console.log('getResult');
            this.getResult();
          }
        }

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
  async getResult() {
    try {
      const allData = await this.apiService.getDataFromApi();
      this.ohlc = allData.data.slice();
      const i = this.ohlc.length - 1;

      if (this.inLong) {
        if (this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.utils.addFees(0.91));
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(0.91)) : '';
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(-1)) : '';
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
        }

        this.inLong = this.inPosition = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }


      else if (this.inShort) {
        if (!this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.utils.addFees(0.91));
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(0.91)) : '';
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(this.utils.addFees(-1)) : '';
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), this.utils.getDate());
        }

        this.inShort = this.inPosition = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }
    } catch (error) {
      console.error(error);
      this.utils.stopProcess();
    }
  }


  bullOrBear() {
    const i = this.ohlc.length - 1;
    this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);
    const rsiValues = this.indicators.rsi(this.ohlc, 14);

    const lookback = 1;
    if (this.stratService.bullStrategy(this.haOhlc, i, lookback, rsiValues)) {
      this.inLong = true;
    } else if (this.stratService.bearStrategy(this.haOhlc, i, lookback, rsiValues)) {
      this.inShort = true;
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
