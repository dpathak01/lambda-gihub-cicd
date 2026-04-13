const dynamoClient = require("../src/dynamoClient");
const { handler } = require("../src/index");

describe("Lambda handler", () => {
    beforeEach(() => {
        process.env.TABLE_NAME = "demo-table";
        process.env.KEY_ATTRIBUTE = "productId";
        dynamoClient.send = jest.fn();
    });

    afterEach(() => {
        delete process.env.TABLE_NAME;
        delete process.env.KEY_ATTRIBUTE;
    });

    test("returns 400 when productId is missing", async () => {
        const response = await handler({});

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toEqual({
            message: "Missing required path/query/body parameter: productId",
        });
    });

    test("returns 404 when item is not found", async () => {
        dynamoClient.send.mockResolvedValue({});

        const response = await handler({ pathParameters: { productId: "missing-id" } });

        expect(dynamoClient.send).toHaveBeenCalled();
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ message: "Item not found" });
    });

    test("returns 200 with productId when product table is used", async () => {
        const dynamoItem = {
            productId: { S: "P006" },
            name: { S: "Cotton Bedsheet" },
        };

        dynamoClient.send.mockResolvedValue({ Item: dynamoItem });

        const response = await handler({ pathParameters: { productId: "P006" } });

        expect(dynamoClient.send).toHaveBeenCalled();
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ productId: "P006", name: "Cotton Bedsheet" });
    });
});
