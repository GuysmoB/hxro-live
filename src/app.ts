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
let allData = [];
let winTrades = [];
let loseTrades = [];
let allTrades = [];
let telegramBot: any;
const toDataBase = false;

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

    /* allData = this.utils.dataArrayBuilder(items, allData, timeFrameArray);
    this.init(); */
  }

  /**
   * Point d'entrée.
   */
  async init(): Promise<void> {
    try {
      /* await this.utils.login(ig);
      ig.connectToLightstreamer();
      ig.subscribeToLightstreamer("MERGE", items, ["BID", "OFFER"], 3);
      ig.lsEmitter.on("update", (streamData: any) => {
        const minuteTimestamp = Math.trunc(Date.now() / 60000);
        const ticker = this.utils.getTicker(streamData[1]);
        const price = this.utils.round(
          parseFloat(streamData[2]) +
            (parseFloat(streamData[3]) - parseFloat(streamData[2])) / 2,
          5
        );

        for (const timeFrame of timeFrameArray) {
          const tickerTf = ticker + "_" + timeFrame + "MINUTE";

          if (
            minuteTimestamp % timeFrame === 0 &&
            !allData[tickerTf].timeProcessed.find(
              (element: any) => element === minuteTimestamp
            )
          ) {
            allData[tickerTf].timeProcessed.push(minuteTimestamp);

            if (allData[tickerTf].ohlc_tmp) {
              const lastCandle = allData[tickerTf].ohlc_tmp;
              lastCandle.close = price;
              allData[tickerTf].ohlc.push(lastCandle);
              this.findSetupOnClosedCandles(tickerTf);
            }
            allData[tickerTf].ohlc_tmp = {
              date: streamData[0],
              open: price,
              high: price,
              low: price,
            };
          }

          if (allData[tickerTf].ohlc_tmp) {
            let currentCandlestick = allData[tickerTf].ohlc_tmp;
            if (price > currentCandlestick.high) {
              currentCandlestick.high = price;
            }
            if (price < currentCandlestick.low) {
              currentCandlestick.low = price;
            }
          }
          this.entryExit(price, tickerTf, streamData[0]);
        }
      }); */
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Execution de la stratégie principale.
   */
  entryExit(price: number, tickerTf: string, date: Date) {
    let rr: number;
    const rrTarget = 2;
    const data = allData[tickerTf].ohlc;
    const inLong = this.getDirection_Long(tickerTf);
    const inShort = this.getDirection_Short(tickerTf);

    try {
      if (inLong) {
        rr = this.stratService.getFixedTakeProfitAndStopLoss(
          "LONG",
          this.getTickerTfData(tickerTf),
          price
        );
        this.updateResults("LONG", rr, tickerTf);
      } else {
        const res = this.stratService.trigger_EngulfingRetested_Long(
          this.getSnapshot_Long(tickerTf),
          price
        );
        if (res) {
          const date = this.utils.getDate();
          this.setDirection_Long(tickerTf, true);
          this.setSnapshotCanceled_Long(tickerTf, true);
          this.setEntryTime_Long(tickerTf, date);
          this.setEntryPrice_Long(
            tickerTf,
            this.utils.round(res.entryPrice, 5)
          );
          this.setStopLoss_Long(tickerTf, this.utils.round(res.stopLoss, 5));
          this.setTakeProfit_Long(
            tickerTf,
            this.utils.round(
              res.entryPrice + (res.entryPrice - res.stopLoss) * rrTarget,
              5
            )
          );

          if (this.logEnable) {
            console.log("--------");
            console.log(
              "Bullish Engulfing",
              data[this.getSnapshot_Long(tickerTf).time].date
            );
            console.log("Long", tickerTf, date);
            console.log("entryPrice", this.getEntryPrice_Long(tickerTf));
            console.log("stopLoss", this.getStopLoss_Long(tickerTf));
            console.log("takeProfit", this.getTakeProfit_Long(tickerTf));
          }
        }
      }

      if (inShort) {
        rr = this.stratService.getFixedTakeProfitAndStopLoss(
          "SHORT",
          this.getTickerTfData(tickerTf),
          price
        );
        this.updateResults("SHORT", rr, tickerTf);
      } else {
        const res = this.stratService.trigger_EngulfingRetested_Short(
          this.getSnapshot_Short(tickerTf),
          price
        );
        if (res) {
          const date = this.utils.getDate();
          this.setDirection_Short(tickerTf, true);
          this.setSnapshotCanceled_Short(tickerTf, true);
          this.setEntryTime_Short(tickerTf, date);
          this.setEntryPrice_Short(
            tickerTf,
            this.utils.round(res.entryPrice, 5)
          );
          this.setStopLoss_Short(tickerTf, this.utils.round(res.stopLoss, 5));
          this.setTakeProfit_Short(
            tickerTf,
            this.utils.round(
              res.entryPrice + (res.entryPrice - res.stopLoss) * rrTarget,
              5
            )
          );

          if (this.logEnable) {
            console.log("--------");
            console.log(
              "Bearish Engulfing",
              data[this.getSnapshot_Short(tickerTf).time].date
            );
            console.log("Short", tickerTf, date);
            console.log("entryPrice", this.getEntryPrice_Short(tickerTf));
            console.log("stopLoss", this.getStopLoss_Short(tickerTf));
            console.log("takeProfit", this.getTakeProfit_Short(tickerTf));
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update trades's state, global R:R and log.
   */
  updateResults(direction: string, rr: number, tickerTf: any) {
    try {
      if (rr !== undefined) {
        allTrades.push(rr);
        if (rr >= 0) {
          winTrades.push(rr);
        } else if (rr < 0) {
          loseTrades.push(rr);
        }

        if (toDataBase) {
          this.utils.insertTrade(
            this.getTickerTfData(tickerTf),
            tickerTf,
            winTrades,
            loseTrades,
            allTrades
          );
        }

        if (direction === "LONG") {
          this.setDirection_Long(tickerTf, false);
        } else if (direction === "SHORT") {
          this.setDirection_Short(tickerTf, false);
        } else {
          console.error("Long or short ?");
        }

        console.log("-------------------------");
        console.log("---- UPDATED RESULTS ----");
        console.log("-------------------------");
        console.log("Last R:R", rr);
        console.log(direction, tickerTf, this.utils.getDate());
        console.log(
          "Trades : Gagnes / Perdus / Total",
          winTrades.length,
          loseTrades.length,
          winTrades.length + loseTrades.length
        );
        console.log(
          "Total R:R",
          this.utils.round(
            loseTrades.reduce((a, b) => a + b, 0) +
              winTrades.reduce((a, b) => a + b, 0),
            2
          )
        );
        console.log(
          "Avg R:R",
          this.utils.round(
            allTrades.reduce((a, b) => a + b, 0) / allTrades.length,
            2
          )
        );
        console.log(
          "Winrate " +
            this.utils.round(
              (winTrades.length / (loseTrades.length + winTrades.length)) * 100,
              2
            ) +
            "%"
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Recherche de setup sur les candles closes et les sauvegarde dans AllData
   */
  findSetupOnClosedCandles(tickerTf: string) {
    try {
      const data = allData[tickerTf].ohlc;
      const atr = this.indicators.atr(data, 10);
      const inLong = this.getDirection_Long(tickerTf);
      const inShort = this.getDirection_Short(tickerTf);

      if (!inLong) {
        const isLongSetup = this.stratService.strategy_EngulfingRetested_Long(
          data,
          atr
        );
        if (isLongSetup) {
          this.setSnapshot_Long(tickerTf, isLongSetup);
        }
      }
      if (!inShort) {
        const isShortSetup = this.stratService.strategy_EngulfingRetested_Short(
          data,
          atr
        );
        if (isShortSetup) {
          this.setSnapshot_Short(tickerTf, isShortSetup);
        }
      }

      const isLiquidityShort = this.stratService.checkLiquidity_Short(
        data,
        atr
      );
      const isLiquidityLong = this.stratService.checkLiquidity_Long(data, atr);
      if (isLiquidityLong) {
        //console.log(tickerTf + ' | ' + this.utils.getDate() + ' | Bullish liquidity found !');
        this.setLiquidity_Long(tickerTf, isLiquidityLong);
      }
      if (isLiquidityShort) {
        //console.log(tickerTf + ' | ' + this.utils.getDate() + ' | Bearish liquidity found !');
        this.setLiquidity_Short(tickerTf, isLiquidityShort);
      }

      const isLiquidityShortSetup =
        this.stratService.strategy_LiquidityBreakout_Short(
          data,
          this.getLiquidity_Short(tickerTf)
        );
      const isLiquidityLongSetup =
        this.stratService.strategy_LiquidityBreakout_Long(
          data,
          this.getLiquidity_Long(tickerTf)
        );
      if (isLiquidityLongSetup) {
        this.setLiquidity_Long(tickerTf, undefined);
        this.utils.sendTelegramMsg(
          telegramBot,
          this.config.chatId,
          tickerTf + " | Bullish liquidity setup"
        );
      }
      if (isLiquidityShortSetup) {
        this.setLiquidity_Short(tickerTf, undefined);
        this.utils.sendTelegramMsg(
          telegramBot,
          this.config.chatId,
          tickerTf + " | Bearish liquidity setup"
        );
      }
    } catch (error) {
      console.error(error);
      this.utils.stopProcess();
    }
  }

  /**
   * GETTER / SETTER
   */
  getLiquidity_Long(tickerTf: any) {
    return allData[tickerTf].liquidity_Long;
  }
  getTickerTfData(tickerTf: any) {
    return allData[tickerTf];
  }
  getDirection_Long(tickerTf: any) {
    return allData[tickerTf].inLong;
  }
  getEntryPrice_Long(tickerTf: any) {
    return allData[tickerTf].entryPrice_Long;
  }
  getStopLoss_Long(tickerTf: any) {
    return allData[tickerTf].initialStopLoss_Long;
  }
  getTakeProfit_Long(tickerTf: any) {
    return allData[tickerTf].takeProfit_Long;
  }
  getSnapshot_Long(tickerTf: any) {
    return allData[tickerTf].snapshot_Long;
  }

  setLiquidity_Long(tickerTf: any, value: any) {
    allData[tickerTf].liquidity_Long = value;
  }
  setEntryTime_Long(tickerTf: any, value: any) {
    allData[tickerTf].entryTime_Long = value;
  }
  setSnapshot_Long(tickerTf: any, value: any) {
    allData[tickerTf].snapshot_Long = value;
  }
  setSnapshotCanceled_Long(tickerTf: any, value: boolean) {
    allData[tickerTf].snapshot_Long.canceled = value;
  }
  setDirection_Long(tickerTf: any, value: boolean) {
    allData[tickerTf].inLong = value;
  }
  setEntryPrice_Long(tickerTf: any, value: number) {
    allData[tickerTf].entryPrice_Long = value;
  }
  setStopLoss_Long(tickerTf: any, value: number) {
    allData[tickerTf].initialStopLoss_Long = value;
  }
  setTakeProfit_Long(tickerTf: any, value: number) {
    allData[tickerTf].takeProfit_Long = value;
  }

  getLiquidity_Short(tickerTf: any) {
    return allData[tickerTf].liquidity_Short;
  }
  getDirection_Short(tickerTf: any) {
    return allData[tickerTf].inShort;
  }
  getEntryPrice_Short(tickerTf: any) {
    return allData[tickerTf].entryPrice_Short;
  }
  getStopLoss_Short(tickerTf: any) {
    return allData[tickerTf].initialStopLoss_Short;
  }
  getTakeProfit_Short(tickerTf: any) {
    return allData[tickerTf].takeProfit_Short;
  }
  getSnapshot_Short(tickerTf: any) {
    return allData[tickerTf].snapshot_Short;
  }

  setLiquidity_Short(tickerTf: any, value: any) {
    allData[tickerTf].liquidity_Short = value;
  }
  setEntryTime_Short(tickerTf: any, value: any) {
    allData[tickerTf].entryTime_Short = value;
  }
  setSnapshot_Short(tickerTf: any, value: any) {
    allData[tickerTf].snapshot_Short = value;
  }
  setSnapshotCanceled_Short(tickerTf: any, value: boolean) {
    allData[tickerTf].snapshot_Short.canceled = value;
  }
  setDirection_Short(tickerTf: any, value: boolean) {
    allData[tickerTf].inShort = value;
  }
  setEntryPrice_Short(tickerTf: any, value: number) {
    allData[tickerTf].entryPrice_Short = value;
  }
  setStopLoss_Short(tickerTf: any, value: number) {
    allData[tickerTf].initialStopLoss_Short = value;
  }
  setTakeProfit_Short(tickerTf: any, value: number) {
    allData[tickerTf].takeProfit_Short = value;
  }
}

const utilsService = new UtilsService();
new App(
  utilsService,
  new StrategiesService(utilsService),
  new Config(),
  new IndicatorsService(utilsService)
);
