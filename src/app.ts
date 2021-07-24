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
  payout: any;
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
      if (this.countdown == 5 || this.countdown == 20 || this.countdown == 35 || this.countdown == 50) {
        (this.isCountDownSnipe) ? this.isCountDownSnipe = false : '';
      }

      if ((this.countdown == 0 || this.countdown == 15 || this.countdown == 30 || this.countdown == 45) && !this.isCountDownSnipe) {
        this.isCountDownSnipe = true;

        if (this.ohlc_tmp) {
          this.ohlc_tmp.close = this.streamData.price;
          this.ohlc.push(this.ohlc_tmp);

          if (this.countdown == 45) {
            //console.log('boolOrBear');
            this.payout = await _this.apiService.getActualPayout(this.token);
            this.bullOrBear();
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
  async getResult(direction: string) {
    try {
      const allData = await this.apiService.getDataFromApi();
      this.ohlc = allData.data.slice();
      const i = this.ohlc.length - 2; // candle avant la candle en cour
      this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);

      if (direction == 'long') {
        if (this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.payout.moonPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.moonPayout) : '';
          console.log('++ | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
          console.log('-- | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
        }
        this.inLong = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }

      else if (direction == 'short') {
        if (!this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.payout.rektPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.rektPayout) : '';
          console.log('++ | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
          console.log('-- | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
        }

        this.inShort = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }
    } catch (error) {
      console.error(error);
    }
  }


  /**
   * Attend la prochaine candle pour update les résultats.
   */
  waitingNextCandle(direction: string) {
    //console.log("Waiting next candle |", direction, this.utils.getDate());
    setTimeout(async () => {
      this.getResult(direction);
    }, 90000); // 1min 30s
  }



  /**
   * Check for setup on closed candles
   */
  bullOrBear() {
    const i = this.ohlc.length - 1;
    this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);
    const rsiValues = this.indicators.rsi(this.ohlc, 14);

    if (!this.inLong && !this.inShort) {
      if (this.stratService.bullStrategy(this.haOhlc, i, rsiValues)) {
        this.inLong = true;
        this.waitingNextCandle('long');
      } else if (this.stratService.bearStrategy(this.haOhlc, i, rsiValues)) {
        this.inShort = true;
        this.waitingNextCandle('short');
      }
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



}

const utilsService = new UtilsService();
new App(
  utilsService,
  new StrategiesService(utilsService),
  new Config(),
  new IndicatorsService(utilsService),
  new ApiService(utilsService)
);
