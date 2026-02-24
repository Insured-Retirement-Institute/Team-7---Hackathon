import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { BedrockRuntimeClient, ConverseCommand, ConverseCommandInput, ConverseCommandOutput, Message  } from "@aws-sdk/client-bedrock-runtime";

const brt = new BedrockRuntimeClient({ region: "us-east-1" });
const model = {
    model_id: "anthropic.claude-opus-4-5-20251101-v1:0",
    max_tokens: 120000
}

async function get_ai_summary(product_data: string){

    const base_prompt = `
        You are a bot with expertice knowledge in annuities and how to provide important info about them. Following task:
        - Analyze this provided json data to find import features that I would like to know. 
        - Summarize your findings in a well thought our response. 
        - Use clear langauge that any average person can understand.
        - Return only a summary in few most important areas of importance in paragraphs
        Return in following example response:
        {{ example_response }}
        Do not explain what you did or how you got your response.
        `;

    const example_response = {
        "summary":"The summary here.."
    }

    const final_prompt = base_prompt.replace('{{ example_response }}', JSON.stringify(example_response));

    const conversation: Message[] = [
        { role: "user", content: [{ text: product_data }] },
        { role: "user", content: [{ text: final_prompt }] }
    ];

      const command = new ConverseCommand({
        modelId: model.model_id,
        messages: conversation,
        inferenceConfig: {
          maxTokens: 12000,
          temperature: 0.6,
          topP: 0.9
        }
      });
  
      const response = await brt.send(command) as ConverseCommandOutput;
      const response_content = response?.output?.message?.content ?? [];  
      const response_text = response_content[0]?.text;

      if(!response_text){
        return "";
      }

      return JSON.parse(response_text);
}

async function get_ai_watch_items(product_data: string){

    const base_prompt = `
        You are a bot with expertice knowledge in annuities and how to provide important info about them. Following task:
        - Analyze this provided json data to find import features that I would like to know. 
        - Items to watch for in this product
        - Use clear langauge that any average person can understand.
        Return in following example response:
        {{ example_response }}
        Do not explain what you did or how you got your response.
        `;

    const example_response = {
        "watch_items": []
    }

    const final_prompt = base_prompt.replace('{{ example_response }}', JSON.stringify(example_response));

    const conversation: Message[] = [
        { role: "user", content: [{ text: product_data }] },
        { role: "user", content: [{ text: final_prompt }] }
    ];

      const command = new ConverseCommand({
        modelId: model.model_id,
        messages: conversation,
        inferenceConfig: {
          maxTokens: 12000,
          temperature: 0.6,
          topP: 0.9
        }
      });
  
      const response = await brt.send(command) as ConverseCommandOutput;
      const response_content = response?.output?.message?.content ?? [];  
      const response_text = response_content[0]?.text;

      if(!response_text){
        return "";
      }


      return JSON.parse(response_text);
}

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    try {
        console.log(event.body);
        const event_body = JSON.parse(event.body || "");

        const product = event_body.product;

        if (!product) {
            return { statusCode: 400, body: JSON.stringify("Product data provided") };
        }

        const ai_summary = await get_ai_summary(product);
        const ai_watch_items = await get_ai_watch_items(product);

        const jsonResponse = {
            "ai_summary": ai_summary,
            "ai_watch_items": ai_watch_items
        }

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