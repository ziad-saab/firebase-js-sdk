
import { FirebaseApp } from '@firebase/app-types';

interface ServiceFactory {
  function(app: FirebaseApp): any;
}

export class Container {
  register(name: string, serviceFactory: ServiceFactory): void {
    
  }
}