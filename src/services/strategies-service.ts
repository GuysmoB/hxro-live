import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }

  strategy_live_test_Long(data: any, i: number, currentCandle: any): any {
    return {
      startTrade: !this.isUp(data, i, 0) && currentCandle.low < this.low(data, i, 0) && currentCandle.close > this.high(data, i, 0),
      stopLoss: currentCandle.low,
      entryPrice: currentCandle.close
    };
  }

  strategy_live_test_Short(data: any, i: number, currentCandle: any): any {
    return {
      startTrade: this.isUp(data, i, 0) && currentCandle.high > this.high(data, i, 0) && currentCandle.close < this.low(data, i, 0),
      stopLoss: currentCandle.high,
      entryPrice: currentCandle.close
    };
  }



  getFixedTakeProfitAndStopLoss(direction: string, tickerTfData: any, price: number): number {
    let result: number;

    if (direction === 'LONG') {
      const entryPrice = tickerTfData.entryPrice_Long;
      const initialStopLoss = tickerTfData.initialStopLoss_Long;
      const takeProfit = tickerTfData.takeProfit_Long;

      if (price >= takeProfit) {
        result = this.utils.getRiskReward(entryPrice, initialStopLoss, takeProfit);
      } else if (price <= initialStopLoss) {
        result = -1;
      }
    } else if (direction === 'SHORT') {
      const entryPrice = tickerTfData.entryPrice_Short;
      const initialStopLoss = tickerTfData.initialStopLoss_Short;
      const takeProfit = tickerTfData.takeProfit_Short;

      if (price <= takeProfit) {
        result = this.utils.getRiskReward(entryPrice, initialStopLoss, takeProfit);
      } else if (price >= initialStopLoss) {
        result = -1;
      }
    } else {
      console.error('Long or Short ?');
    }

    return result;
  }


  trigger_EngulfingRetested_Long(snapshot: any, price: number): any {
    // ici condition pour limit ou market
    if (snapshot && !snapshot.canceled && price <= snapshot.candle1.open) {
      return {
        stopLoss: snapshot.candle1.low,
        entryPrice: snapshot.candle1.open,
      };
    }
  }

  strategy_EngulfingRetested_Long(data: any, atr: any): any {
    if (data.length >= 2) {
      const i = data.length - 1;
      const candle0Size = Math.abs(this.close(data, i, 0) - this.open(data, i, 0));
      const candle1Size = Math.abs(this.close(data, i, 1) - this.open(data, i, 1));
      const isHigherHigh = this.high(data, i, 1) < this.high(data, i, 0); // anti gap
      const isLongEnough1 = (candle1Size / atr[i]) > 0.1;
      const setup = !this.isUp(data, i, 1) && isLongEnough1 && this.isUp(data, i, 0) && (candle0Size >= candle1Size * 3) && isHigherHigh;

      if (setup) {
        //console.log('candle size', candle1Size / atr[i], data[i].date);
        return {
          time: i,
          canceled: false,
          candle1: data[i - 1],
          candle0: data[i]
        };
      }
    }
  }


  strategy_EngulfingRetested_Short(data: any, atr: any): any {
    if (data.length >= 2) {
      const i = data.length - 1;
      const candle0Size = Math.abs(this.close(data, i, 0) - this.open(data, i, 0));
      const candle1Size = Math.abs(this.close(data, i, 1) - this.open(data, i, 1));
      const isLowerLow = this.low(data, i, 1) > this.low(data, i, 0); // anti gap
      const isLongEnough1 = (candle1Size / atr[i]) > 0.1;
      const setup = this.isUp(data, i, 1) && isLongEnough1 && !this.isUp(data, i, 0) && (candle0Size >= candle1Size * 3) && isLowerLow;

      if (setup) {
        //console.log('candle size', candle1Size / atr[i], data[i].date);
        return {
          time: i,
          canceled: false,
          candle1: data[i - 1],
          candle0: data[i]
        };
      }
    }
  }

  trigger_EngulfingRetested_Short(snapshot: any, price: number): any {
    if (snapshot && !snapshot.canceled && price >= snapshot.candle1.open) {
      return {
        stopLoss: snapshot.candle1.high,
        entryPrice: snapshot.candle1.open,
      };
    }
  }


  checkLiquidity_Long(data: any, atr: any): any {
    let lastLow: number;
    let $brokenLows = 0;
    const lookback = 10;

    if (data.length >= lookback + 1) {
      const i = data.length - 1;
      const $swingHigh = this.utils.highest(data, i - 1, 'high', lookback);
      const $swingLow = this.utils.lowest(data, i - 1, 'low', lookback);
      const rangeHigh = this.utils.round(this.low(data, i, 0) + atr[i] * 2.5, 5);
      const rangeLow = this.low(data, i, 0);

      for (let k = (i - 1); k >= (i - lookback); k--) {
        const candle = data[k];
        if ($brokenLows === 0) {
          lastLow = candle.low;
        }

        if (candle.low < this.low(data, i, 0)) {
          return undefined;
        } else if (candle.low <= rangeHigh && candle.low >= rangeLow && candle.low <= lastLow) {
          $brokenLows++;
          lastLow = candle.low;
        }
      }

      if ($brokenLows >= 2) {
        return {
          time: i,
          swingHigh: $swingHigh,
          swingLow: $swingLow,
          brokenLows: $brokenLows
        };
      }
    }
  }


  checkLiquidity_Short(data: any, atr: any): any {
    let lastHigh: number;
    let $brokenHighs = 0;
    const lookback = 10;

    if (data.length >= lookback + 1) {
      const i = data.length - 1;
      const $swingHigh = this.utils.highest(data, i - 1, 'high', lookback);
      const $swingLow = this.utils.lowest(data, i - 1, 'low', lookback);
      const rangeHigh = this.high(data, i, 0);
      const rangeLow = this.utils.round(this.high(data, i, 0) - atr[i] * 2.5, 5);

      for (let k = (i - 1); k >= (i - lookback); k--) {
        const candle = data[k];
        if ($brokenHighs === 0) {
          lastHigh = candle.high;
        }

        if (candle.high > this.high(data, i, 0)) {
          return undefined;
        } else if (candle.high <= rangeHigh && candle.high >= rangeLow && candle.high >= lastHigh) {
          $brokenHighs++;
          lastHigh = candle.high;
        }
      }

      if ($brokenHighs >= 2) {
        return {
          time: i,
          swingHigh: $swingHigh,
          swingLow: $swingLow,
          brokenHighs: $brokenHighs
        };
      }
    }
  }

  /**
   * Identifier une prise de liquidite, le garder en mémoire. Attendre un break
   */
  strategy_LiquidityBreakout_Long(data: any, liquidity: any): boolean {
    if (data.length >= 1 && liquidity) {
      const i = data.length - 1;
      const timeToBreak = (i - liquidity.time);
      return liquidity && this.high(data, i, 0) > liquidity.swingHigh && this.isUp(data, i, 0) && timeToBreak > 0 && timeToBreak <= 2;
    }
  }

  strategy_LiquidityBreakout_Short(data: any, liquidity: any): boolean {
    if (data.length >= 1 && liquidity) {
      const i = data.length - 1;
      const timeToBreak = (i - liquidity.time);
      return liquidity && this.low(data, i, 0) < liquidity.swingLow && !this.isUp(data, i, 0) && timeToBreak > 0 && timeToBreak <= 2;
    }
  }

}

export default new StrategiesService(new UtilsService());
