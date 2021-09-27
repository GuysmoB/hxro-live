import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }


  bullStrategy(haData: any, i: number, rsiValues: any, ratio): any {
    if (haData[i].bull && rsiValues[i] < 40 && ratio > 0) {
      console.log('Entry bull setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(haData: any, i: number, rsiValues: any, ratio): any {
    if (haData[i].bear && rsiValues[i] > 60 && ratio < -0) {
      console.log('Entry bear setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
