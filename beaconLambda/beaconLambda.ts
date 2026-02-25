import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

const API_URL = "https://stage-profile.an.annuitynexus.com/api/profile";
export async function handler(event: APIGatewayProxyEvent, context: Context) {
    //make sure request is complete
    console.log(event);
    if(!event.body){
        return makeResponse(400, 'Request missing body');
    }
    const body = JSON.parse(event.body);
    if(!body.cusip){
        return makeResponse(400, 'Request missing cusip');
    }
    const cusip = body.cusip;
    if(!body.policyDate) {
        return makeResponse(400, 'Request missing policyDate');
    }
    const policyDate = body.policyDate;
    //get beacon creds from secret
    const secretClient = new SecretsManagerClient({
        region: "us-east-1"
    })
    let secretResponse;
    try {
        secretResponse = await secretClient.send(
            new GetSecretValueCommand({
                SecretId: 'beaconSecret'
            })
        )
    } catch (error) {
        console.log(error);
        return makeResponse(500, 'Service Error');
    }
    
    //send beacon request and return
    console.log(secretResponse.SecretString);
    let beaconResponse;
    try {
        const fullPath = `${API_URL}?token=${JSON.parse(secretResponse.SecretString || '').apiToken}&cusip=${cusip}&policyDate=${policyDate}`
        console.log(fullPath);
        await fetch(fullPath)
        .then(response => {
            console.log(response);
            if (!response.ok){
                throw new Error;
            }
            beaconResponse = response.text();
        })
        .catch(error => {
            throw new Error;
        });
        console.log(beaconResponse);
        return makeResponse(200, JSON.stringify(beaconResponse));
    } catch (error) {
        return makeResponse(500, "Error fetching data from beacon.")
    }
    
}

export function makeResponse(statusCode: number, message: string){
    return {
        statusCode: statusCode,
        body: JSON.stringify(message)
    }
}