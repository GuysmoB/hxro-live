// https://www.digitalocean.com/community/tutorials/setting-up-a-node-project-with-typescript
// https://github.com/nikvdp/pidcrypt/issues/5#issuecomment-511383690
// https://github.com/Microsoft/TypeScript/issues/17645#issuecomment-320556012

process.env.NTBA_FIX_319 = "1"; // disable Telegram error
import { ApiService } from './services/api.service';
import { IndicatorsService } from "./services/indicators.service";
import { CandleAbstract } from "./abstract/candleAbstract";
import { StrategiesService } from "./services/strategies-service";
import { UtilsService } from "./services/utils-service";
import config, { Config } from "./config";
import firebase from "firebase";
import TelegramBot from "node-telegram-bot-api";

class App extends CandleAbstract {

  winTrades = [];
  loseTrades = [];
  inLong = false;
  inShort = false;
  looseInc = 0;
  looseInc2 = 0;
  payout: any;
  result: any;
  ohlc = [];
  haOhlc = [];
  telegramBot: any;
  seriesId: any;
  ticker: string;
  tf: string
  allTickers = ['BTC', 'ETH', 'BNB'];
  allTf = ['1', '5'];
  urlPath: string;
  delay: number;
  seuil: number;
  toDataBase = true;
  databasePath: string;
  token = 'b15346f6544b4d289139b2feba668b20';

  constructor(private utils: UtilsService, private stratService: StrategiesService, private config: Config,
    private indicators: IndicatorsService, private apiService: ApiService) {
    super();
    this.ticker = process.argv.slice(2)[0];
    this.tf = process.argv.slice(2)[1];
    this.urlPath = 'https://' + this.ticker + '.history.hxro.io/' + this.tf + 'm';
    this.databasePath = '/' + this.ticker + this.tf;
    this.initApp();


    let lastTime: number;
    setInterval(async () => {
      let second = new Date().getSeconds();
      let minute = new Date().getMinutes();

      if (this.tf == '1') {
        if (second == 55 && second != lastTime) {
          this.main();
        }
      } else if (this.tf == '5') {
        if (second == 55 && (minute.toString().substr(-1) == '4' || minute.toString().substr(-1) == '9') && second != lastTime) {
          this.main();
        }
      }

      lastTime = second;
    }, 500);
  }

  /**
   * Initialisation de l'app
   */
  async initApp() {
    console.log('App started |', this.utils.getDate());
    process.title = 'main';
    this.utils.checkArg(this.ticker, this.tf, this.allTickers, this.allTf);
    firebase.initializeApp(config.firebaseConfig);
    this.toDataBase ? this.utils.initFirebase(this.databasePath) : '';
    this.telegramBot = new TelegramBot(config.token, { polling: false });
    this.seriesId = await this.apiService.getSeriesId(this.token, this.ticker, this.tf);

    if (this.tf == '1') {
      this.delay = (60 * 1000) + (30 * 1000); //1min 30s
      this.seuil = 80;
    } else if (this.tf == '5') {
      this.delay = (60 * 1000) * 5 + (30 * 1000); //5min 30s
      this.seuil = 250;
    }
  }


  /**
   * logique principale..
   */
  async main() {
    this.payout = await this.apiService.getActualPayout(this.seriesId);
    const allData = await this.apiService.getDataFromApi(this.urlPath);
    this.ohlc = allData.data.slice();
    this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);
    this.bullOrBear();
  }


  /**
   * Mets à jour les resultats de trade.
   */
  async getResult(direction: string) {
    try {
      const allData = await this.apiService.getDataFromApi(this.urlPath);
      this.ohlc = allData.data.slice();
      const i = this.ohlc.length - 2; // candle avant la candle en cour
      this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);

      if (direction == 'long') {
        if (this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.payout.moonPayout);
          this.result = this.payout.moonPayout;
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.moonPayout, this.databasePath) : '';
          console.log('++ | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc = 0;
        } else {
          this.loseTrades.push(-1);
          this.result = -1;
          this.toDataBase ? this.utils.updateFirebaseResults(-1, this.databasePath) : '';
          console.log('-- | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc++;
        }
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }

      else if (direction == 'short') {
        if (!this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.payout.rektPayout);
          this.result = this.payout.rektPayout;
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.rektPayout, this.databasePath) : '';
          console.log('++ | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc2 = 0;
        } else {
          this.loseTrades.push(-1);
          this.result = -1;
          this.toDataBase ? this.utils.updateFirebaseResults(-1, this.databasePath) : '';
          console.log('-- | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc2++;
        }
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
    setTimeout(async () => {
      this.getResult(direction);
    }, this.delay);
  }


  /**
   * Check for setup on closed candles
   */
  bullOrBear() {
    const i = this.ohlc.length - 1; // candle en construction
    const rsiValues = this.indicators.rsi(this.ohlc, 14);

    if (this.inLong) {
      if (this.stopConditions(i)) {
        this.inLong = false;
        this.looseInc = 0;
        console.log('Exit long setup', this.utils.getDate());
      } else {
        this.waitingNextCandle('long');
      }
    } else if (this.inShort) {
      if (this.stopConditions(i)) {
        this.inShort = false;
        this.looseInc2 = 0;
        console.log('Exit short setup', this.utils.getDate());
      } else {
        this.waitingNextCandle('short');
      }
    }

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
      console.log("Something went wrong when trying to send a Telegram notification", err);
    }
  }

  /**
   * Message formatté pour Télégram
   */
  formatTelegramMsg() {
    return this.ticker + ' ' + this.tf + 'min\n' +
      'Total trades : ' + (this.winTrades.length + this.loseTrades.length) + '\n' +
      'Payout : ' + this.result + '\n' +
      'Total R:R : ' + (this.utils.round(this.loseTrades.reduce((a, b) => a + b, 0) + this.winTrades.reduce((a, b) => a + b, 0), 2)) + '\n' +
      'Winrate : ' + (this.utils.round((this.winTrades.length / (this.loseTrades.length + this.winTrades.length)) * 100, 2) + '%');
  }

  /**
   * Conditions de stop loss
   */
  stopConditions(i: number): boolean {
    return (
      (this.inLong && this.haOhlc[i].bear) ||
      (this.inShort && this.haOhlc[i].bull) ||
      this.looseInc == 5 ||
      this.looseInc2 == 5 ||
      Math.abs(this.high(this.ohlc, i, 0) - this.low(this.ohlc, i, 0)) > this.seuil
    ) ? true : false;
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
