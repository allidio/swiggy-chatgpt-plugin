import { z } from "zod";
const emptySchema = {};
const stageSchema = z.enum(["discover", "cart", "order", "track", "support"]);
const viewSchema = z.enum(["addresses", "products", "goToItems", "cart", "checkout", "orders", "tracking", "support", "generic"]);
const moneySchema = z.union([z.string(), z.number()]);
const productVariationSchema = z
    .object({
    spinId: z.string().optional(),
    skuId: z.string().optional(),
    quantityDescription: z.string().optional(),
    displayName: z.string().optional(),
    brandName: z.string().optional(),
    price: z
        .object({
        mrp: z.number().optional(),
        offerPrice: z.number().optional()
    })
        .passthrough()
        .optional(),
    isInStockAndAvailable: z.boolean().optional(),
    imageUrl: z.string().optional()
})
    .passthrough();
const productSchema = z
    .object({
    displayName: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    brand: z.string().optional(),
    inStock: z.boolean().optional(),
    isAvail: z.boolean().optional(),
    variations: z.array(productVariationSchema).optional(),
    variants: z.array(productVariationSchema).optional(),
    productId: z.string().optional(),
    parentProductId: z.string().optional(),
    isPromoted: z.boolean().optional()
})
    .passthrough();
const addressSchema = z
    .object({
    id: z.string().optional(),
    addressId: z.string().optional(),
    addressLine: z.string().optional(),
    fullAddress: z.string().optional(),
    phoneNumber: z.string().optional(),
    addressCategory: z.string().optional(),
    addressTag: z.string().optional()
})
    .passthrough();
const paginationSchema = z
    .object({
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
    totalPages: z.number().optional(),
    hasMore: z.boolean().optional()
})
    .passthrough();
const lineItemSchema = z
    .object({
    spinId: z.string().optional(),
    skuId: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    productName: z.string().optional(),
    quantity: z.union([z.string(), z.number()]).optional(),
    price: moneySchema.optional(),
    total: moneySchema.optional(),
    amount: moneySchema.optional(),
    displayPrice: z.string().optional(),
    imageUrl: z.string().optional()
})
    .passthrough();
const orderSchema = z
    .object({
    orderId: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional(),
    orderStatus: z.string().optional(),
    createdAt: z.string().optional(),
    date: z.string().optional(),
    amount: moneySchema.optional(),
    total: moneySchema.optional(),
    grandTotal: moneySchema.optional(),
    items: z.array(lineItemSchema).optional()
})
    .passthrough();
function normalizedOutput(dataSchema) {
    return {
        service: z.literal("swiggy-instamart"),
        toolName: z.string(),
        stage: stageSchema,
        view: viewSchema,
        success: z.boolean(),
        message: z.string().optional(),
        data: dataSchema.optional(),
        stateVersion: z.number()
    };
}
export const genericOutputSchema = normalizedOutput(z.unknown());
const addressListOutputSchema = normalizedOutput(z
    .object({
    addresses: z.array(addressSchema).optional(),
    total: z.number().optional(),
    pagination: paginationSchema.optional()
})
    .passthrough());
const productSearchOutputSchema = normalizedOutput(z
    .object({
    nextOffset: z.union([z.string(), z.number()]).optional(),
    products: z.array(productSchema).optional(),
    items: z.array(productSchema).optional(),
    results: z.array(productSchema).optional()
})
    .passthrough());
const bulkSearchOutputSchema = normalizedOutput(z
    .object({
    addressId: z.string(),
    queries: z.array(z.string()),
    totalQueries: z.number(),
    failedCount: z.number(),
    groups: z.array(z
        .object({
        query: z.string(),
        success: z.boolean(),
        products: z.array(productSchema).optional(),
        productCount: z.number().optional(),
        nextOffset: z.union([z.string(), z.number()]).optional(),
        message: z.string().optional(),
        error: z.string().optional()
    })
        .passthrough())
})
    .passthrough());
const cartOutputSchema = normalizedOutput(z
    .object({
    items: z.array(lineItemSchema).optional(),
    cartItems: z.array(lineItemSchema).optional(),
    products: z.array(lineItemSchema).optional(),
    grandTotal: moneySchema.optional(),
    total: moneySchema.optional(),
    amount: moneySchema.optional(),
    availablePaymentMethods: z.array(z.unknown()).optional(),
    paymentMethods: z.array(z.unknown()).optional()
})
    .passthrough());
const ordersOutputSchema = normalizedOutput(z
    .object({
    orders: z.array(orderSchema).optional(),
    items: z.array(orderSchema).optional(),
    results: z.array(orderSchema).optional()
})
    .passthrough());
export const instamartTools = [
    {
        name: "get_addresses",
        title: "Get Addresses",
        stage: "discover",
        readOnly: true,
        description: "Use this when the user needs to choose a saved Swiggy delivery address before shopping on Instamart. Stop after showing addresses until the user selects one.",
        inputSchema: emptySchema,
        outputSchema: addressListOutputSchema
    },
    {
        name: "create_address",
        title: "Create Address",
        stage: "discover",
        readOnly: false,
        description: "Use this when the user has no suitable saved delivery address and wants to create one. Parse address fields from the full address and require latitude and longitude.",
        inputSchema: {
            fullAddress: z.string(),
            addressLine: z.string(),
            addressLine2: z.string(),
            locality: z.string().optional(),
            city: z.string(),
            postalCode: z.string(),
            latitude: z.number(),
            longitude: z.number(),
            addressCategory: z.enum(["HOME", "WORK", "OFFICE", "FRIENDS_AND_FAMILY", "OTHER"]),
            addressTag: z.string().optional(),
            userName: z.string(),
            userPhone: z.string(),
            receiverName: z.string().optional(),
            receiverPhone: z.string().optional()
        },
        outputSchema: genericOutputSchema
    },
    {
        name: "delete_address",
        title: "Delete Address",
        stage: "discover",
        readOnly: false,
        destructive: true,
        requiresConfirmation: true,
        description: "Use this when the user explicitly confirms they want to permanently delete a saved Swiggy address.",
        inputSchema: { addressId: z.string() },
        outputSchema: genericOutputSchema
    },
    {
        name: "search_products",
        title: "Search Products",
        stage: "discover",
        readOnly: true,
        description: "Use this when the user wants to find Instamart products for a selected address. Always show variants and ask which variant before adding to cart.",
        inputSchema: {
            addressId: z.string(),
            query: z.string(),
            offset: z.number().optional()
        },
        outputSchema: productSearchOutputSchema
    },
    {
        name: "search_products_bulk",
        title: "Search Products Bulk",
        stage: "discover",
        readOnly: true,
        description: "Use this when the user provides a comma-separated grocery list. Splits the list into keywords, repeatedly calls Swiggy Instamart search_products for each keyword at the selected address, and returns results grouped by keyword.",
        inputSchema: {
            addressId: z.string(),
            queries: z.string().describe("Comma-separated product keywords, for example: milk, bread, eggs"),
            offset: z.number().optional()
        },
        outputSchema: bulkSearchOutputSchema
    },
    {
        name: "your_go_to_items",
        title: "Your Go To Items",
        stage: "discover",
        readOnly: true,
        description: "Use this when the user wants frequent, recent, reorder, or usual Instamart items for the selected delivery address.",
        inputSchema: {
            addressId: z.string(),
            offset: z.number().optional()
        },
        outputSchema: productSearchOutputSchema
    },
    {
        name: "clear_cart",
        title: "Clear Cart",
        stage: "cart",
        readOnly: false,
        destructive: true,
        description: "Use this when the user wants to remove all Instamart cart items, or before rebuilding a cart for a different address.",
        inputSchema: emptySchema,
        outputSchema: genericOutputSchema
    },
    {
        name: "get_cart",
        title: "Get Cart",
        stage: "cart",
        readOnly: true,
        description: "Use this when the user wants to review the current Instamart cart, bill breakdown, delivery charges, and available payment methods before checkout.",
        inputSchema: emptySchema,
        outputSchema: cartOutputSchema
    },
    {
        name: "update_cart",
        title: "Update Cart",
        stage: "cart",
        readOnly: false,
        description: "Use this when the user wants to update the Instamart cart. This replaces the entire cart with the provided items, so include every intended item.",
        inputSchema: {
            selectedAddressId: z.string(),
            items: z.array(z.object({
                spinId: z.string(),
                quantity: z.number().int().min(0)
            }))
        },
        outputSchema: cartOutputSchema
    },
    {
        name: "checkout",
        title: "Checkout",
        stage: "order",
        readOnly: false,
        requiresConfirmation: true,
        description: "Use this only after showing the complete cart, total, delivery address, and available payment method, and after the user explicitly confirms placing the Instamart order.",
        inputSchema: {
            addressId: z.string(),
            paymentMethod: z.string().optional()
        },
        outputSchema: genericOutputSchema
    },
    {
        name: "get_orders",
        title: "Get Orders",
        stage: "track",
        readOnly: true,
        description: "Use this when the user asks for Instamart order history, recent orders, active orders, reorders, or when you need an order ID before tracking.",
        inputSchema: {
            count: z.number().optional(),
            orderType: z.string().optional(),
            activeOnly: z.boolean().optional()
        },
        outputSchema: ordersOutputSchema
    },
    {
        name: "get_order_details",
        title: "Get Order Details",
        stage: "track",
        readOnly: true,
        description: "Use this when the user wants detailed item and bill information for a specific Instamart order ID.",
        inputSchema: { orderId: z.string() },
        outputSchema: ordersOutputSchema
    },
    {
        name: "track_order",
        title: "Track Order",
        stage: "track",
        readOnly: true,
        description: "Use this when the user asks where an Instamart order is, its live status, ETA, or delivery progress. Requires order ID and delivery coordinates.",
        inputSchema: {
            orderId: z.string(),
            lat: z.number(),
            lng: z.number()
        },
        outputSchema: genericOutputSchema
    },
    {
        name: "report_error",
        title: "Report Error",
        stage: "support",
        readOnly: false,
        description: "Use this when the user wants to report a Swiggy MCP error. Include the failed tool, message, flow, and relevant IDs in toolContext.",
        inputSchema: {
            tool: z.string(),
            domain: z.string().optional(),
            errorMessage: z.string(),
            flowDescription: z.string().optional(),
            toolContext: z.record(z.string(), z.unknown()).optional(),
            userNotes: z.string().optional()
        },
        outputSchema: genericOutputSchema
    }
];
export function getLocalToolDefinition(name) {
    return instamartTools.find((tool) => tool.name === name);
}
//# sourceMappingURL=swiggySchemas.js.map