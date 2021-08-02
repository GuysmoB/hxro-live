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
  payout: any;
  countdown: any;
  result: any;
  obStream: any;
  ob: any;
  snapshot: any;
  /* snapshot = {
    bids: [
      ['41716.56000000', '0.01918900'],
      ['41710.88000000', '0.60000000'],
      ['41710.87000000', '0.92750600'],
      ['41710.85000000', '0.16772000'],
      ['41710.11000000', '0.03000000'],
      ['41709.11000000', '0.07534200'],
    ],
    asks: [
      ['41716.57000000', '0.48386100'],
      ['41719.54000000', '0.01372400'],
      ['41719.99000000', '0.00753900'],
      ['41720.00000000', '0.07851500'],
      ['41722.08000000', '0.08799900'],
    ]
  }; */
  obBuffer = {
    bids: [],
    asks: []
  };
  obBufferTest = {
    bids: [
      ['41716.56000000', '0.00000000'],
      ['41710.88000000', '0.60055555'],
      ['41710.87000000', '0.92750600'],
      ['41710.85000000', '0.99772000'],
      ['41710.11000000', '0.00000000'],
      ['50000.00000000', '0.35240000'],
    ],
    asks: [
      ['41716.57000000', '0.48386100'],
      ['41719.99000000', '0.00753900'],
      ['41720.00000000', '1.33351500'],
      ['41722.08000000', '0.00000000'],
      ['11720.00000000', '2.00001500'],
      ['11000.00000000', '0.00000000'],
    ]
  };
  ohlc = [];
  haOhlc = [];
  telegramBot: any;
  toDataBase = false;
  isCountDown55 = false;
  token = 'b15346f6544b4d289139b2feba668b20';

  constructor(private utils: UtilsService, private stratService: StrategiesService, private config: Config,
    private indicators: IndicatorsService, private apiService: ApiService) {
    super();
    console.log('App started |', utils.getDate());
    firebase.initializeApp(config.firebaseConfig);
    this.telegramBot = new TelegramBot(config.token, { polling: false });
    this.getObStreamData('wss://stream.binance.com:9443/ws/btcusdt@depth@1000ms');
    this.main();
  }



  /**
   * Gère la création des candles et de la logique principale..
   */
  async main() {
    const _this = this;

    setInterval(async () => {
      this.countdown = new Date().getSeconds();
      if (this.countdown == 10) {
        (this.isCountDown55) ? this.isCountDown55 = false : '';
      }
      /* 
            if (this.countdown == 55 && !this.isCountDown55) {
              this.isCountDown55 = true; // Doit être la 1er ligne
              this.payout = await _this.apiService.getActualPayout(this.token);
              const allData = await this.apiService.getDataFromApi();
              this.ohlc = allData.data.slice();
              this.haOhlc = this.utils.setHeikenAshiData(this.ohlc);
              this.bullOrBear();
            } */
    }, 500);


    setInterval(async () => {
      this.snapshot.bids = _this.utils.obUpdate(this.obBuffer.bids, this.snapshot.bids);
      this.snapshot.asks = _this.utils.obUpdate(this.obBuffer.asks, this.snapshot.asks);
      this.snapshot.bids.sort((a, b) => b[0] - a[0]);
      this.snapshot.asks.sort((a, b) => a[0] - b[0]);

      const res1 = this.utils.getVolumeDepth(this.snapshot, 1);
      const res2p5 = this.utils.getVolumeDepth(this.snapshot, 2.5);
      const res5 = this.utils.getVolumeDepth(this.snapshot, 5);
      const res10 = this.utils.getVolumeDepth(this.snapshot, 10);
      console.log('................');
      console.log('Delta  10%', _this.utils.round(res10.bidVolume - res10.askVolume, 2), _this.utils.getDate());
      console.log('Delta   5%', _this.utils.round(res5.bidVolume - res5.askVolume, 2), _this.utils.getDate());
      console.log('Delta 2.5%', _this.utils.round(res2p5.bidVolume - res2p5.askVolume, 2), _this.utils.getDate());
      console.log('Delta   1%', _this.utils.round(res1.bidVolume - res1.askVolume, 2), _this.utils.getDate());
      this.obBuffer = { bids: [], asks: [] };
    }, 30000);
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
      const stream = JSON.parse(event.data);
      _this.obBuffer.bids = [..._this.obBuffer.bids, ..._this.utils.convertArrayToNumber(stream.b)];
      _this.obBuffer.asks = [..._this.obBuffer.asks, ..._this.utils.convertArrayToNumber(stream.a)];
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
   * Mets à jour les resultats de trade.
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
          this.result = this.payout.moonPayout;
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.moonPayout) : '';
          console.log('++ | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc = 0;
        } else {
          this.loseTrades.push(-1);
          this.result = -1;
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
          console.log('-- | Payout ', this.payout.moonPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc++;
        }
        this.sendTelegramMsg(this.telegramBot, this.config.chatId, this.formatTelegramMsg());
      }

      else if (direction == 'short') {
        if (!this.isUp(this.ohlc, i, 0)) {
          this.winTrades.push(this.payout.rektPayout);
          this.result = this.payout.rektPayout;
          this.toDataBase ? this.utils.updateFirebaseResults(this.payout.rektPayout) : '';
          console.log('++ | Payout ', this.payout.rektPayout, '| Total ', this.utils.round(this.utils.arraySum(this.winTrades.concat(this.loseTrades)), 2), '|', this.utils.getDate(this.ohlc[i].time));
          this.looseInc2 = 0;
        } else {
          this.loseTrades.push(-1);
          this.result = -1;
          this.toDataBase ? this.utils.updateFirebaseResults(-1) : '';
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
    }, 90000); // 1min 30s
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
    } else {
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

  formatTelegramMsg() {
    return 'Total trades : ' + (this.winTrades.length + this.loseTrades.length) + '\n' +
      'Payout : ' + this.result + '\n' +
      'Total R:R : ' + (this.utils.round(this.loseTrades.reduce((a, b) => a + b, 0) + this.winTrades.reduce((a, b) => a + b, 0), 2)) + '\n' +
      'Winrate : ' + (this.utils.round((this.winTrades.length / (this.loseTrades.length + this.winTrades.length)) * 100, 2) + '%');
  }

  stopConditions(i: number): boolean {
    return (
      (this.inLong && this.haOhlc[i].bear) ||
      (this.inShort && this.haOhlc[i].bull) ||
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
  new ApiService(utilsService)
);
