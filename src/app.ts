import { ApiService } from './services/api.service';
// https://www.digitalocean.com/community/tutorials/setting-up-a-node-project-with-typescript
// https://github.com/nikvdp/pidcrypt/issues/5#issuecomment-511383690
// https://github.com/Microsoft/TypeScript/issues/17645#issuecomment-320556012

process.env.NTBA_FIX_319 = "1"; // disable Telegram error
import { IndicatorsService } from "./services/indicators.service";
import { CandleAbstract } from "./abstract/candleAbstract";
import { StrategiesService } from "./services/strategies-service";
import { UtilsService } from "./services/utils-service";
import config, { Config } from "./config";
import firebase from "firebase";
import TelegramBot from "node-telegram-bot-api";
import WebSocket from "ws";

class App extends CandleAbstract {

  snapshot: any;
  tmpBuffer = [];
  winTrades = [];
  loseTrades = [];
  inLong = false;
  inShort = false;
  payout: any;
  seriesId: any;
  telegramBot: any;
  ticker: string;
  ratio2p5: number;
  allTickers = ['BTC', 'ETH', 'BNB'];
  obDatabasePath = '/orderbook-data';
  toDataBase = false;
  databasePath: string;
  token = 'b15346f6544b4d289139b2feba668b20';

  constructor(private utils: UtilsService, private stratService: StrategiesService, private config: Config,
    private indicators: IndicatorsService, private apiService: ApiService) {
    super();
    this.ticker = process.argv.slice(2)[0];
    this.databasePath = '/sniper-5min-' + this.ticker;
    this.initApp();
  }



  /**
   * Initialisation de l'app
   */
  async initApp() {
    process.title = 'sniper-5min';
    console.log('App started |', this.utils.getDate());
    this.utils.checkArg(this.ticker, this.allTickers);
    firebase.initializeApp(config.firebaseConfig);
    this.toDataBase ? this.utils.initFirebase(this.databasePath) : '';
    this.telegramBot = new TelegramBot(config.token, { polling: false });
    this.seriesId = await this.apiService.getSeriesId(this.token, this.ticker);
    this.getObStreamData('wss://fstream.binance.com/stream?streams=btcusdt@depth'); //futurs
    this.main();
  }



  /**
   * Gère la création des candles et de la logique principale..
   */
  async main() {
    const _this = this;
    let lastTime: number;

    setInterval(async () => {
      let second = new Date().getSeconds();
      let minute = new Date().getMinutes().toString().substr(-1);

      if (second == 1 && second != lastTime) {
        this.manageOb();
      }

      if (second == 55 && (minute == '4' || minute == '9') && second != lastTime) {
        this.payout = await _this.apiService.getActualPayout(this.seriesId);
        if (this.payout.nextPrizePool > 200) {
          this.bullOrBear();
        } else {
          console.log('nextPrizePool', this.payout.nextPrizePool, _this.utils.getDate())
        }
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
    const delta1 = this.utils.round(res1.bidVolume - res1.askVolume, 2);
    const delta2p5 = this.utils.round(res2p5.bidVolume - res2p5.askVolume, 2);
    const ratio1 = this.utils.round((delta1 / (res1.bidVolume + res1.askVolume)) * 100, 2);
    this.ratio2p5 = this.utils.round((delta2p5 / (res2p5.bidVolume + res2p5.askVolume)) * 100, 2);

    console.log(
      '------ ' + this.utils.getDate() + ' ------\n' +
      'Depth 2.5% | Ratio% : ' + this.ratio2p5 + '\n' +
      'Depth   1% | Ratio% : ' + ratio1 + '\n' +
      'Snapshot asks size : ' + this.snapshot.asks.length + '\n' +
      'Snapshot bids size : ' + this.snapshot.bids.length + '\n'
    );

    const allData = await this.apiService.getDataFromApi('https://' + this.ticker + '.history.hxro.io/1m');
    const res = allData.data.slice();
    const lastCandle = res[res.length - 2];
    try {
      this.toDataBase ? await firebase.database().ref(this.obDatabasePath).push({
        close: lastCandle.close,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        time: lastCandle.time,
        ratio1: ratio1,
        ratio2p5: this.ratio2p5,
      }) : '';
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
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  async getResult(direction: string) {
    try {
      let ohlc = await this.apiService.getDataFromApi('https://' + this.ticker + '.history.hxro.io/5m');
      ohlc = ohlc.data.slice();
      const i = ohlc.length - 2; // candle avant la candle en cour

      if (direction == 'long') {
        if (this.isUp(ohlc, i, 0)) {
          this.winTrades.push(this.payout.moonPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.moonPayout, this.databasePath) : '';
          console.log('++ | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1, this.databasePath) : '';
          console.log('-- | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        }
        this.inLong = false;
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }

      else if (direction == 'short') {
        if (!this.isUp(ohlc, i, 0)) {
          this.winTrades.push(this.payout.rektPayout);
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.rektPayout, this.databasePath) : '';
          console.log('++ | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(ohlc[i].time));
        } else {
          this.loseTrades.push(-1);
          this.toDataBase ? this.utils.updateFirebaseResults(-1, this.databasePath) : '';
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
    setTimeout(async () => {
      this.getResult(direction);
    }, 60000 * 5 + 30000); // 5min 30s
  }



  /**
   * Check for setup on closed candles
   */
  async bullOrBear() {
    let ohlc = await this.apiService.getDataFromApi('https://' + this.ticker + '.history.hxro.io/1m');
    ohlc = ohlc.data.slice();
    const i = ohlc.length - 1;
    const haOhlc = this.utils.setHeikenAshiData(ohlc);
    const rsiValues = this.indicators.rsi(ohlc, 14);

    if (!this.inLong && !this.inShort) {
      if (this.stratService.bullStrategy(i, rsiValues, this.ratio2p5)) {
        this.inLong = true;
        this.waitingNextCandle('long');
      } else if (this.stratService.bearStrategy(i, rsiValues, this.ratio2p5)) {
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
    return 'Snipe ' + this.ticker + ' 5m\n' +
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
