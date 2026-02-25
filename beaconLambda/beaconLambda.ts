import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

const API_URL = "https://stage-profile.an.annuitynexus.com/api/profile";
export async function handler(event: APIGatewayProxyEvent, context: Context) {
    //make sure request is complete
    console.log(event);
    if(!event.multiValueQueryStringParameters?.cusip){
        return makeResponse(400, 'Request missing cusip');
    }
    const cusip = event.multiValueQueryStringParameters.cusip;
    if(!event.multiValueQueryStringParameters?.policyDate) {
        return makeResponse(400, 'Request missing policyDate');
    }
    const policyDate = event.multiValueQueryStringParameters.policyDate;
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
    let beaconResponse;
    try {
        const fullPath = `${API_URL}?token=${JSON.parse(secretResponse.SecretString || '').apiToken}&cusip=${cusip}&policyDate=${policyDate}`;
        const response = await fetch(fullPath);
        if(!response.ok){
            const err = await response.text();
            console.log("Error fetching data from beacon", response.status, err);
            return makeResponse(response.status, "Error fetching data from beacon");
        }
        const responseText = await response.text();
        console.log(beaconResponse);
        return makeResponse(200, responseText);
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