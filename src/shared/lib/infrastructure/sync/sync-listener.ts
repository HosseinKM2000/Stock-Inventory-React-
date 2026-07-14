import { networkService } from "../network/network-service";
import { syncService } from "./sync-service";


networkService.subscribe(()=>{

 if(networkService.isOnline()){
    syncService.sync();
 }

});