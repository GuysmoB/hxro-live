import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  lookback = 1;

  constructor(private utils: UtilsService) {
    super();
  }


  bullStrategy(haOhlc: any, i: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - this.lookback); j--) {
      const ha = haOhlc[j];
      if (ha.close > ha.open) { // if bull
        cond = false;
        break;
      }
    }

    if (
      rsiValues
      && rsiValues.length >= 14
      && rsiValues[i] < 50
      && haOhlc[i].bull) {
      console.log('Entry bull setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(haOhlc: any, i: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - this.lookback); j--) {
      const ha = haOhlc[j];
      if (ha.close < ha.open) { // if bear
        cond = false;
        break;
      }
    }

    if (rsiValues
      && rsiValues.length >= 14
      && rsiValues[i] > 50
      && haOhlc[i].bear) {
      console.log('Entry bear setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
