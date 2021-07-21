import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }


  bullStrategy(haOhlc: any, i: number, lookback: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - lookback); j--) {
      const ha = haOhlc[j];
      if (ha.bull) {
        cond = false;
        break;
      }
    }

    if (cond && haOhlc[i].bull /* && rsiValues[i] < 40 */) {
      console.log('Entry bull setup', this.utils.getDate());
      console.log("candle 1", haOhlc[i], this.utils.getDate(haOhlc[i].time));
      console.log("candle 2", haOhlc[i - 1], this.utils.getDate(haOhlc[i - 1].time));
      console.log("candle 3", haOhlc[i - 2], this.utils.getDate(haOhlc[i - 2].time));
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(haOhlc: any, i: number, lookback: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - lookback); j--) {
      const ha = haOhlc[j];
      if (ha.bear) {
        cond = false;
        break;
      }
    }

    if (cond && haOhlc[i].bear /* && rsiValues[i] > 60 */) {
      console.log('Entry bear setup', this.utils.getDate());
      console.log("candle 1", haOhlc[i], this.utils.getDate(haOhlc[i].time));
      console.log("candle 2", haOhlc[i - 1], this.utils.getDate(haOhlc[i - 1].time));
      console.log("candle 3", haOhlc[i - 2], this.utils.getDate(haOhlc[i - 2].time));
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
