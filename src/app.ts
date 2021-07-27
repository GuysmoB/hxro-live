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
  second: any;
  minute: any;
  telegramBot: any;
  toDataBase = false;
  isCountDownReset = false;
  token = 'b15346f6544b4d289139b2feba668b20';
  url = 'wss://btc.data.hxro.io/live';

  constructor(private utils: UtilsService, private stratService: StrategiesService, private config: Config,
    private indicators: IndicatorsService, private apiService: ApiService) {
    super();
    console.log('App started |', utils.getDate());
    firebase.initializeApp(config.firebaseConfig);
    this.telegramBot = new TelegramBot(config.token, { polling: false });
    this.main();
  }



  /**
   * Gère la création des candles et de la logique principale..
   */
  async main() {
    const _this = this;

    setInterval(async () => {
      this.second = new Date().getSeconds();
      this.minute = new Date().getMinutes();

      if (this.second == 10) {
        (this.isCountDownReset) ? this.isCountDownReset = false : '';
      }

      if (this.second == 50 && (this.minute.toString().substr(-1) == '4' || this.minute.toString().substr(-1) == '9') && !this.isCountDownReset) {
        this.isCountDownReset = true;
        this.payout = await _this.apiService.getActualPayout(this.token);
        if (this.payout.nextPrizePool > 200) {
          this.bullOrBear();
        } else {
          console.log('nextPrizePool', this.payout.nextPrizePool, _this.utils.getDate())
        }
      }
    }, 500);
  }


  /**
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  async getResult(direction: string) {
    try {
      let ohlc = await this.apiService.getDataFromApi("https://btc.history.hxro.io/5m");
      ohlc = ohlc.data.slice();
      const i = ohlc.length - 2; // candle avant la candle en cour

      if (direction == 'long') {
        if (this.isUp(ohlc, i, 0)) {
          this.winTrades.push(this.payout.moonPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.moonPayout) : '';
          console.log('++ | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
          console.log('-- | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        }
        this.inLong = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }

      else if (direction == 'short') {
        if (!this.isUp(ohlc, i, 0)) {
          this.winTrades.push(this.payout.rektPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.rektPayout) : '';
          console.log('++ | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
          console.log('-- | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
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
    }, 60000 * 5 + 30000); // 5min 30s
  }



  /**
   * Check for setup on closed candles
   */
  async bullOrBear() {
    let ohlc = await this.apiService.getDataFromApi("https://btc.history.hxro.io/1m");
    ohlc = ohlc.data.slice();
    const i = ohlc.length - 1;
    const haOhlc = this.utils.setHeikenAshiData(ohlc);
    const rsiValues = this.indicators.rsi(ohlc, 14);

    if (!this.inLong && !this.inShort) {
      if (this.stratService.bullStrategy(haOhlc, i, rsiValues)) {
        this.inLong = true;
        this.waitingNextCandle('long');
      } else if (this.stratService.bearStrategy(haOhlc, i, rsiValues)) {
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
      console.log("Something went wrong when trying to send a Telegram notification", err);
    }
  }

  formatTelegramMsg() {
    return 'Snipe 5m\n' +
      'Total trades : ' + (this.winTrades.length + this.loseTrades.length) + '\n' +
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
