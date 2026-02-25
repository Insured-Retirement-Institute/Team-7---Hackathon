import { Context } from "aws-lambda";
import { BedrockRuntimeClient, ConverseCommand, ConverseCommandOutput, Message } from "@aws-sdk/client-bedrock-runtime";

const brt = new BedrockRuntimeClient({ region: "us-east-1" });

const model = {
    model_id: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    max_tokens: 120000
};

function cleanJson(jsonString: string): string {
    // Remove the leading and trailing ```json and ``` markers
    if (jsonString.startsWith("```json")) {
        jsonString = jsonString.slice(7);
    }
    if (jsonString.endsWith("```")) {
        jsonString = jsonString.slice(0, -3);
    }

    // Remove any leading/trailing whitespace
    jsonString = jsonString.trim();

    return jsonString;
}

async function get_ai_summary(product_data: string) {

    const base_prompt = `
        Give me a summary of this annuity policy using the following structure:
        The {policy name}, a {type of annuity} annuity issued by {issuing company}, is designed to provide {primary annuity objective}. The contract includes {key benefits and features specific to this annuity}.
        Only return the paragraph structured like example.
    `;

    const conversation: Message[] = [
        { role: "user", content: [{ text: product_data }] },
        { role: "user", content: [{ text: base_prompt }] }
    ];

    const command = new ConverseCommand({
        modelId: model.model_id,
        messages: conversation,
        inferenceConfig: {
            maxTokens: 32000,
            temperature: 0.5,
            //topP: 0.9
        }
    });

    const response = await brt.send(command) as ConverseCommandOutput;
    const response_content = response?.output?.message?.content ?? [];
    const response_text = response_content[0]?.text;

    if (!response_text) {
        return "";
    }

    return response_text;
}

async function get_ai_watch_items(product_data: string) {

    const base_prompt = `
        You are a bot with expertice knowledge in annuities and how to provide important info about them. Following task:
        - Analyze this provided json data to find import features that I would like to know. 
        - Items to watch for in this product
        - Use clear langauge that any average person can understand.
        - Order the items by importance, with the most important item first.
        Return in following example response:
        {{ example_response }}
        Do not explain what you did or how you got your response.
        `;

    const example_response = {
        "watch_items": [
            {
                "title": "Rider Review",
                "description": "Check quarterly adjustmets.",
                "priority": 10
            }
        ]
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
            maxTokens: 32000,
            temperature: 0.6,
            //topP: 0.9
        }
    });

    const response = await brt.send(command) as ConverseCommandOutput;
    const response_content = response?.output?.message?.content ?? [];
    const response_text = response_content[0]?.text;

    if (!response_text) {
        return "";
    }

    return JSON.parse(cleanJson(response_text));
}

async function get_ai_categorize_annuity(product_data: string) {

    const base_prompt = `
        Categorize this annuity product into one of the following categories:
        - Growth
        - Protection
        - Income
        - Legacy
        Return only the category name nothing else. Do not explain your answer or how you got to it.
    `;

    const conversation: Message[] = [
        { role: "user", content: [{ text: product_data }] },
        { role: "user", content: [{ text: base_prompt }] }
    ];

    const command = new ConverseCommand({
        modelId: model.model_id,
        messages: conversation,
        inferenceConfig: {
            maxTokens: 32000,
            temperature: 0.6,
            //topP: 0.9
        }
    });

    const response = await brt.send(command) as ConverseCommandOutput;
    const response_content = response?.output?.message?.content ?? [];
    const response_text = response_content[0]?.text;

    if (!response_text) {
        return "";
    }

    return response_text.trim();
}

interface AIRequest {
    product: string;
}

export async function handler(event: AIRequest, context: Context) {
    try {
        const product = JSON.parse(event.product || "");

        if (!product) {
            return { statusCode: 400, body: JSON.stringify("No product data provided") };
        }

        const ai_summary = await get_ai_summary(product);
        const ai_watch_items = await get_ai_watch_items(product);
        const ai_category = await get_ai_categorize_annuity(product);

        const jsonResponse = {
            "summary": ai_summary,
            "watch_items": ai_watch_items,
            "category": ai_category
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