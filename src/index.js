const { GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = require("./dynamoClient");

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const keyAttribute = process.env.KEY_ATTRIBUTE || "productId";
    const keyValue =
        event?.pathParameters?.[keyAttribute] ||
        event?.queryStringParameters?.[keyAttribute] ||
        (event?.body ? JSON.parse(event.body)[keyAttribute] : undefined);

    if (!keyValue) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: `Missing required path/query/body parameter: ${keyAttribute}`,
            }),
        };
    }

    if (!tableName) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "TABLE_NAME environment variable is not configured" }),
        };
    }

    const command = new GetItemCommand({
        TableName: tableName,
        Key: marshall({ [keyAttribute]: keyValue }),
    });

    const response = await dynamoClient.send(command);

    if (!response.Item) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "Item not found" }),
        };
    }

    const item = unmarshall(response.Item);

    return {
        statusCode: 200,
        body: JSON.stringify(item),
    };
};
