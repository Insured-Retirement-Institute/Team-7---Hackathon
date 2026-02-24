import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelCommandInput } from "@aws-sdk/client-bedrock-runtime"

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    try {
        console.log(event.body);
        const prompt = JSON.parse(event.body || "").prompt;
        const body = {
            additionalModelRequestFlields: {},
            inferenceConfig: {
                maxTokens: 2560,
                stopSequences: [],
                temperature: 1,
                topP: 1
            },
            messages:[
                {
                    content:[
                        {
                            text: prompt
                        }
                    ],
                    role: "user"
                }
            ],
            performanceConfig: {
                latency: "standard"
            }
        }
        const bedrockInput: InvokeModelCommandInput = {
            body: Buffer.from(prompt),
            modelId: 'amazon.nova-micro-v1:0'
        }
        const command = new InvokeModelCommand(bedrockInput);
        const client = new BedrockRuntimeClient({ region: "us-east-1" });
        const response = await client.send(command);
        const jsonResponse = JSON.parse(Buffer.from(response.body).toString());

        return {
            statusCode: 200,
            body: JSON.stringify(jsonResponse),
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            body: JSON.stringify(error),
        };
    }
}