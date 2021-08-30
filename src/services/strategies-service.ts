import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }


  bullStrategy(haOhlc: any, i: number, rsiValues: any): any {
    if (rsiValues[i] < 35) {
      console.log('Entry bull setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(haOhlc: any, i: number, rsiValues: any): any {
    if (rsiValues[i] > 65) {
      console.log('Entry bear setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
