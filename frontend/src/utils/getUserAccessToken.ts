import { msalInstance } from "..";

export default async function getUserAccessToken(){
    const account = msalInstance.getAllAccounts()[0]
    console.log(msalInstance.getActiveAccount())
    if(account){
        const userAuthentication = await msalInstance.acquireTokenSilent({
            scopes: ['User.Read'],
            account: account
        })
        return userAuthentication.accessToken
    }
}