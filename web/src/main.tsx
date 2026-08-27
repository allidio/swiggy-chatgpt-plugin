import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Home,
  ImageOff,
  Loader2,
  MapPin,
  PackageSearch,
  Plus,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  TicketCheck,
  Trash2,
  Truck
} from "lucide-react";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ToolName =
  | "get_addresses"
  | "create_address"
  | "delete_address"
  | "search_products"
  | "search_products_bulk"
  | "your_go_to_items"
  | "clear_cart"
  | "get_cart"
  | "update_cart"
  | "checkout"
  | "get_orders"
  | "get_order_details"
  | "track_order"
  | "report_error"
  | string;

interface Snapshot {
  service: "swiggy-instamart";
  toolName: ToolName;
  stage: string;
  view: string;
  success: boolean;
  message?: string;
  data?: unknown;
  stateVersion: number;
}

interface SelectedAddress {
  id: string;
  label: string;
  addressLine: string;
  phoneNumber?: string;
  addressCategory?: string;
}

const SELECTED_ADDRESS_STORAGE_KEY = "swiggy-instamart:selected-address";

function AppRoot() {
  const previewResult = getPreviewResult();
  const [latestResult, setLatestResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(() => readStoredSelectedAddress());

  if (previewResult) {
    return (
      <Shell>
        <RoutedInstamartPage result={previewResult} selectedAddress={selectedAddress} onSelectAddress={setSelectedAddress} />
      </Shell>
    );
  }

  const { app, isConnected, error } = useApp({
    appInfo: { name: "Swiggy Instamart Widget", version: "0.2.0" },
    capabilities: {},
    onAppCreated: (instance) => {
      instance.ontoolresult = async (result) => setLatestResult(result);
      instance.onhostcontextchanged = (context) => setHostContext((previous) => ({ ...previous, ...context }));
      instance.onerror = console.error;
    }
  });

  useEffect(() => {
    if (!app || !isConnected) return;
    const height = preferredWidgetHeight();
    app.sendSizeChanged({ width: Math.min(window.innerWidth || 980, 1120), height });
  }, [app, isConnected]);

  if (error) {
    return <Shell><EmptyPage title="Could not open Instamart" detail={error.message} tone="error" /></Shell>;
  }

  if (!isConnected || !app) {
    return <Shell><EmptyPage title="Opening Instamart" detail="Preparing your shopping view..." /></Shell>;
  }

  return (
    <Shell hostContext={hostContext}>
      <RoutedInstamartPage
        app={app}
        result={latestResult}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
        onToolResult={setLatestResult}
      />
    </Shell>
  );
}

function Shell({ children, hostContext }: { children: React.ReactNode; hostContext?: McpUiHostContext }) {
  return (
    <MotionConfig reducedMotion="user">
      <main
        className="app-shell"
        style={{
          paddingTop: hostContext?.safeAreaInsets?.top,
          paddingRight: hostContext?.safeAreaInsets?.right,
          paddingBottom: hostContext?.safeAreaInsets?.bottom,
          paddingLeft: hostContext?.safeAreaInsets?.left
        }}
      >
        <section className="phone-frame">{children}</section>
      </main>
    </MotionConfig>
  );
}

function RoutedInstamartPage({
  app,
  result,
  selectedAddress,
  onSelectAddress,
  onToolResult
}: {
  app?: App;
  result: CallToolResult | null;
  selectedAddress: SelectedAddress | null;
  onSelectAddress: (address: SelectedAddress) => void;
  onToolResult?: (result: CallToolResult) => void;
}) {
  const snapshot = useMemo(() => extractSnapshot(result), [result]);
  const shouldReduceMotion = useReducedMotion();
  const pageKey = snapshot ? `${snapshot.toolName}-${snapshot.stateVersion}` : "instamart-empty";

  useEffect(() => {
    if (selectedAddress) {
      persistSelectedAddress(selectedAddress);
      void updateSelectedAddressModelContext(app, selectedAddress);
    }
  }, [app, selectedAddress]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="route-page"
        key={pageKey}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.995 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {!snapshot ? (
          <PageChrome toolName="instamart" title="Instamart" subtitle="Groceries delivered fast" success>
            <HeroEmpty />
          </PageChrome>
        ) : (
          <PageChrome
            toolName={snapshot.toolName}
            title={titleForTool(snapshot.toolName)}
            subtitle={subtitleForTool(snapshot.toolName, snapshot)}
            success={snapshot.success}
            message={snapshot.message}
          >
            {renderToolPage(snapshot.toolName, snapshot.data, {
              app,
              selectedAddress,
              onSelectAddress,
              onToolResult
            })}
          </PageChrome>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PageChrome({
  children
}: {
  toolName: ToolName;
  title: string;
  subtitle: string;
  success?: boolean;
  message?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <motion.header className="swiggy-header" layout>
        <motion.div
          className="brand-mark"
          initial={{ rotate: -8, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
        >
          S
        </motion.div>
        <span className="brand-wordmark">Swiggy</span>
      </motion.header>

      <div className="page-content">{children}</div>
    </>
  );
}

function renderToolPage(
  toolName: ToolName,
  data: unknown,
  actions: {
    app?: App;
    selectedAddress: SelectedAddress | null;
    onSelectAddress: (address: SelectedAddress) => void;
    onToolResult?: (result: CallToolResult) => void;
  }
) {
  switch (toolName) {
    case "get_addresses":
      return <AddressesPage data={data} selectedAddress={actions.selectedAddress} onSelectAddress={actions.onSelectAddress} />;
    case "create_address":
      return <MutationPage icon={<Home size={22} />} label="Address saved" data={data} />;
    case "delete_address":
      return <MutationPage icon={<Trash2 size={22} />} label="Address deleted" data={data} tone="warning" />;
    case "search_products":
      return <ProductsPage data={data} title="Search results" app={actions.app} selectedAddress={actions.selectedAddress} onToolResult={actions.onToolResult} />;
    case "search_products_bulk":
      return <GroupedProductsPage data={data} app={actions.app} selectedAddress={actions.selectedAddress} onToolResult={actions.onToolResult} />;
    case "your_go_to_items":
      return <ProductsPage data={data} title="Your go-to items" app={actions.app} selectedAddress={actions.selectedAddress} onToolResult={actions.onToolResult} />;
    case "get_cart":
      return <CartPage data={data} title="Your cart" />;
    case "update_cart":
      return <CartPage data={data} title="Cart updated" />;
    case "clear_cart":
      return <MutationPage icon={<ShoppingCart size={22} />} label="Cart cleared" data={data} tone="warning" />;
    case "checkout":
      return <CheckoutPage data={data} />;
    case "get_orders":
      return <OrdersPage data={data} />;
    case "get_order_details":
      return <OrderDetailsPage data={data} />;
    case "track_order":
      return <TrackingPage data={data} />;
    case "report_error":
      return <SupportPage data={data} />;
    default:
      return <RawDataPage data={data} />;
  }
}

function AddressesPage({
  data,
  selectedAddress,
  onSelectAddress
}: {
  data: unknown;
  selectedAddress: SelectedAddress | null;
  onSelectAddress: (address: SelectedAddress) => void;
}) {
  const addresses = pickArray(data, ["addresses", "items", "results"]);
  const total = readNumber(data, ["total", "pagination.total"]);

  if (!addresses.length) {
    return <EmptyPage title="No addresses found" detail="Add an address in Swiggy, then run get_addresses again." />;
  }

  return (
    <div className="stack">
      <SectionTitle title="Choose a delivery address" detail={total ? `${total} saved addresses` : undefined} />
      {selectedAddress ? (
        <div className="selection-banner">
          <CheckCircle2 size={16} />
          <span>Delivering to {selectedAddress.label}</span>
        </div>
      ) : null}
      {addresses.map((address, index) => {
        const normalizedAddress = normalizeAddress(address);
        const isSelected = normalizedAddress ? selectedAddress?.id === normalizedAddress.id : false;
        return (
          <motion.button
            type="button"
            className={isSelected ? "address-card selectable selected" : "address-card selectable"}
            key={normalizedAddress?.id ?? index}
            onClick={() => normalizedAddress && onSelectAddress(normalizedAddress)}
            {...cardMotion(index)}
            whileTap={{ scale: 0.985 }}
          >
            <div className="card-leading orange-soft"><MapPin size={20} /></div>
            <div className="card-main">
              <div className="card-title-row">
                <h2>{normalizedAddress?.label || "Saved address"}</h2>
                <span className="category-pill">{normalizedAddress?.addressCategory || "Other"}</span>
              </div>
              <p>{normalizedAddress?.addressLine || compactJson(address)}</p>
              <div className="meta-row">
                <span>{normalizedAddress?.phoneNumber || "Phone hidden"}</span>
                <span>ID {normalizedAddress?.id || "unknown"}</span>
              </div>
            </div>
            <span className={isSelected ? "select-dot selected" : "select-dot"}>{isSelected ? <CheckCircle2 size={18} /> : null}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function ProductsPage({
  data,
  title,
  app,
  selectedAddress,
  onToolResult
}: {
  data: unknown;
  title: string;
  app?: App;
  selectedAddress: SelectedAddress | null;
  onToolResult?: (result: CallToolResult) => void;
}) {
  const products = pickArray(data, ["products", "items", "results", "cards"]);

  if (!products.length) {
    return <EmptyPage title="No items found" detail="Try a broader product name or a different selected address." />;
  }

  return (
    <div className="stack">
      <SectionTitle title={title} detail={`${products.length} items shown`} />
      <div className="product-grid">
        {products.map((product, index) => (
          <ProductCard
            product={product}
            app={app}
            selectedAddress={selectedAddress}
            onToolResult={onToolResult}
            key={readString(product, ["id", "productId", "spinId"]) ?? index}
          />
        ))}
      </div>
    </div>
  );
}

function GroupedProductsPage({
  data,
  app,
  selectedAddress,
  onToolResult
}: {
  data: unknown;
  app?: App;
  selectedAddress: SelectedAddress | null;
  onToolResult?: (result: CallToolResult) => void;
}) {
  const groups = pickArray(data, ["groups"]);

  if (!groups.length) {
    return <EmptyPage title="No grouped results" detail="Run search_products_bulk with addressId and comma-separated queries." />;
  }

  return (
    <div className="stack">
      <SectionTitle title="Grouped grocery search" detail={`${groups.length} keywords`} />
      {groups.map((group, index) => {
        const query = readString(group, ["query"]) || `Search ${index + 1}`;
        const products = pickArray(group, [
          "products",
          "items",
          "results",
          "data.products",
          "data.items",
          "data.results",
          "result.structuredContent.products",
          "result.structuredContent.items"
        ]);
        const success = readBoolean(group, ["success"]);
        return (
          <motion.section className="group-section" key={query} {...cardMotion(index)}>
            <div className="group-heading">
              <div>
                <span>Keyword</span>
                <h2>{query}</h2>
              </div>
              <strong>{success === false ? "Failed" : `${products.length} items`}</strong>
            </div>
            {success === false ? (
              <div className="group-error">{readString(group, ["error"]) || "This keyword search failed."}</div>
            ) : products.length ? (
              <div className="product-grid compact">
                {products.map((product, productIndex) => (
                  <ProductCard
                    product={product}
                    app={app}
                    selectedAddress={selectedAddress}
                    onToolResult={onToolResult}
                    key={readString(product, ["id", "productId", "spinId"]) ?? productIndex}
                  />
                ))}
              </div>
            ) : (
              <EmptyPage title="No products" detail={`No products returned for ${query}.`} compact />
            )}
          </motion.section>
        );
      })}
    </div>
  );
}

function ProductCard({
  product,
  app,
  selectedAddress,
  onToolResult
}: {
  product: unknown;
  app?: App;
  selectedAddress: SelectedAddress | null;
  onToolResult?: (result: CallToolResult) => void;
}) {
  const [cartStatus, setCartStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const variants = pickArray(product, ["variations", "variants", "items"]);
  const firstVariant = variants[0];
  const imageUrl = normalizeImageUrl(
    readString(firstVariant, ["imageUrl", "image", "thumbnail"]) ||
      readString(product, ["imageUrl", "image", "thumbnail", "imageId"])
  );
  const price = formatPrice(readMoney(firstVariant, ["price.offerPrice", "offerPrice", "price", "displayPrice"]) ?? readMoney(product, ["price.offerPrice", "offerPrice", "price", "displayPrice"]));
  const mrp = formatPrice(readMoney(firstVariant, ["price.mrp", "mrp"]) ?? readMoney(product, ["mrp"]));
  const quantity =
    readString(firstVariant, ["quantityDescription", "quantity", "packSize", "unit"]) ||
    readString(product, ["quantityDescription", "quantity", "packSize"]);
  const brand = readString(product, ["brand", "brandName"]) || readString(firstVariant, ["brandName"]);
  const isPromoted = readBoolean(product, ["isPromoted"]);
  const inStock =
    readBoolean(firstVariant, ["isInStockAndAvailable"]) ??
    readBoolean(product, ["inStock", "isAvail", "available"]);
  const spinId = readString(firstVariant, ["spinId"]) || readString(product, ["spinId", "id", "productId"]);
  const skuId = readString(firstVariant, ["skuId"]) || readString(product, ["skuId"]);
  const canAdd = Boolean(app && selectedAddress?.id && spinId && inStock !== false);

  async function addToCart() {
    if (!app || !selectedAddress?.id || !spinId || cartStatus === "adding") return;
    setCartStatus("adding");
    try {
      const result = await app.callServerTool({
        name: "update_cart",
        arguments: {
          selectedAddressId: selectedAddress.id,
          items: [{ spinId, quantity: 1 }]
        }
      });
      onToolResult?.(result);
      await app.updateModelContext({
        content: [
          {
            type: "text",
            text: `User added ${readString(product, ["name", "displayName", "title"]) || "an Instamart item"} to the cart for selected address ${selectedAddress.label}.`
          }
        ],
        structuredContent: {
          swiggyInstamart: {
            selectedAddress,
            lastCartAction: {
              action: "add",
              spinId,
              skuId,
              quantity: 1,
              productName: readString(product, ["name", "displayName", "title"]),
              brand
            }
          }
        }
      });
      setCartStatus("added");
    } catch (error) {
      console.error(error);
      setCartStatus("error");
    }
  }

  return (
    <motion.article className="product-card" {...cardMotion(0)} whileTap={{ scale: 0.985 }}>
      <ProductImage src={imageUrl} alt={readString(product, ["name", "displayName", "title"]) || "Instamart item"} />
      <div className="product-body">
        <div className="product-kicker">
          <span>{brand || "Instamart"}</span>
          {isPromoted ? <strong><Sparkles size={12} /> Featured</strong> : null}
        </div>
        <h2>{readString(product, ["name", "displayName", "title"]) || "Instamart item"}</h2>
        <p>{quantity || readString(product, ["category", "description"]) || "Available at selected address"}</p>
        <div className="product-footer">
          <div className="price-stack">
            <strong>{price || "Price in Swiggy"}</strong>
            {mrp && mrp !== price ? <span>{mrp}</span> : null}
          </div>
          <span className={inStock === false ? "stock-chip out" : "stock-chip"}>{inStock === false ? "Out" : "In stock"}</span>
        </div>
        {variants.length > 1 ? (
          <div className="variant-row">
            {variants.slice(0, 3).map((variant, index) => (
              <span key={readString(variant, ["spinId", "skuId"]) ?? index}>
                {readString(variant, ["quantityDescription", "packSize", "quantity"]) || `Var ${index + 1}`}
                {formatPrice(readMoney(variant, ["price.offerPrice", "offerPrice", "displayPrice"])) ? ` · ${formatPrice(readMoney(variant, ["price.offerPrice", "offerPrice", "displayPrice"]))}` : ""}
              </span>
            ))}
          </div>
        ) : spinId ? (
          <div className="sku-line">SKU {spinId}</div>
        ) : null}
        <button className="add-cart-button" type="button" disabled={!canAdd || cartStatus === "adding"} onClick={addToCart}>
          {cartStatus === "adding" ? <Loader2 size={15} className="spin" /> : cartStatus === "added" ? <CheckCircle2 size={15} /> : <Plus size={15} />}
          <span>{cartStatus === "added" ? "Added" : cartStatus === "error" ? "Try again" : selectedAddress ? "Add" : "Select address"}</span>
        </button>
      </div>
    </motion.article>
  );
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="product-image fallback">
        <ImageOff size={25} />
      </div>
    );
  }
  return (
    <div className="product-image">
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

function normalizeImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("media-assets.swiggy.com/")) return `https://${trimmed}`;
  return trimmed;
}

function CartPage({ data, title }: { data: unknown; title: string }) {
  const items = pickArray(data, ["items", "cartItems", "products"]);
  const total =
    readString(data, ["grandTotal", "total", "bill.grandTotal", "bill.total", "billBreakdown.grandTotal"]) ||
    readString(data, ["amount"]);
  const paymentMethods = pickArray(data, ["availablePaymentMethods", "paymentMethods"]);

  return (
    <div className="stack">
      <SectionTitle title={title} detail={items.length ? `${items.length} cart items` : "Review before checkout"} />
      {items.length ? (
        items.map((item, index) => <LineItem item={item} key={readString(item, ["spinId", "id"]) ?? index} />)
      ) : (
        <EmptyPage title="Cart data unavailable" detail="Run get_cart to fetch the latest Swiggy cart." compact />
      )}
      <SummaryPanel total={total} paymentMethods={paymentMethods} raw={data} />
    </div>
  );
}

function LineItem({ item }: { item: unknown }) {
  return (
    <motion.article className="line-item" {...cardMotion(0)} whileTap={{ scale: 0.99 }}>
      <div className="mini-thumb"><ShoppingBag size={18} /></div>
      <div>
        <h2>{readString(item, ["name", "displayName", "title", "productName"]) || "Cart item"}</h2>
        <p>{readString(item, ["quantity", "packSize", "unit", "description"]) || compactJson(item)}</p>
      </div>
      <strong>{readString(item, ["price", "total", "amount", "displayPrice"]) || ""}</strong>
    </motion.article>
  );
}

function SummaryPanel({ total, paymentMethods, raw }: { total?: string; paymentMethods: unknown[]; raw: unknown }) {
  return (
    <motion.article className="summary-panel" {...cardMotion(1)}>
      <div>
        <span>To pay</span>
        <strong>{total || "See bill"}</strong>
      </div>
      <div>
        <span>Payment</span>
        <strong>{paymentMethods.length ? paymentMethods.map((method) => readString(method, ["name", "type", "id"]) || String(method)).join(", ") : "From Swiggy"}</strong>
      </div>
      {!total ? <details><summary>Bill payload</summary><pre>{JSON.stringify(raw, null, 2)}</pre></details> : null}
    </motion.article>
  );
}

function CheckoutPage({ data }: { data: unknown }) {
  return (
    <div className="stack">
      <div className="success-hero">
        <TicketCheck size={34} />
        <h2>Checkout result</h2>
        <p>{readString(data, ["message", "status", "orderStatus"]) || "Swiggy returned the latest checkout status."}</p>
      </div>
      <RawDataPage data={data} compact />
    </div>
  );
}

function OrdersPage({ data }: { data: unknown }) {
  const orders = pickArray(data, ["orders", "items", "results"]);
  if (!orders.length) {
    return <EmptyPage title="No orders found" detail="No active or recent Instamart orders were returned." />;
  }
  return (
    <div className="stack">
      <SectionTitle title="Instamart orders" detail={`${orders.length} orders`} />
      {orders.map((order, index) => (
        <motion.article className="order-card" key={readString(order, ["orderId", "id"]) ?? index} {...cardMotion(index)}>
          <div className="card-leading green-soft"><ReceiptText size={20} /></div>
          <div className="card-main">
            <h2>{readString(order, ["orderId", "id"]) || `Order ${index + 1}`}</h2>
            <p>{readString(order, ["status", "orderStatus", "subtitle"]) || compactJson(order)}</p>
            <div className="meta-row">
              <span>{readString(order, ["createdAt", "date", "time"]) || "Recent"}</span>
              <span>{readString(order, ["amount", "total", "grandTotal"]) || ""}</span>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function OrderDetailsPage({ data }: { data: unknown }) {
  const items = pickArray(data, ["items", "products", "orderItems"]);
  return (
    <div className="stack">
      <SectionTitle title="Order details" detail={readString(data, ["orderId", "id", "status"])} />
      {items.length ? items.map((item, index) => <LineItem item={item} key={index} />) : <RawDataPage data={data} compact />}
    </div>
  );
}

function TrackingPage({ data }: { data: unknown }) {
  return (
    <div className="stack">
      <div className="tracking-card">
        <div className="delivery-pin"><Truck size={28} /></div>
        <div>
          <h2>{readString(data, ["status", "orderStatus", "trackingStatus"]) || "Tracking order"}</h2>
          <p>{readString(data, ["eta", "estimatedDeliveryTime", "message"]) || "Live delivery details from Swiggy."}</p>
        </div>
      </div>
      <RawDataPage data={data} compact />
    </div>
  );
}

function SupportPage({ data }: { data: unknown }) {
  return (
    <div className="stack">
      <div className="support-card">
        <AlertTriangle size={28} />
        <div>
          <h2>Support report ready</h2>
          <p>{readString(data, ["summary", "message", "reportLink"]) || "Share this diagnostic report with Swiggy support."}</p>
        </div>
      </div>
      <RawDataPage data={data} compact />
    </div>
  );
}

function MutationPage({ icon, label, data, tone = "success" }: { icon: React.ReactNode; label: string; data: unknown; tone?: "success" | "warning" }) {
  return (
    <div className="stack">
      <div className={tone === "success" ? "success-hero" : "warning-hero"}>
        {icon}
        <h2>{label}</h2>
        <p>{readString(data, ["message", "status"]) || "Swiggy has returned the latest state."}</p>
      </div>
      <RawDataPage data={data} compact />
    </div>
  );
}

function RawDataPage({ data, compact = false }: { data: unknown; compact?: boolean }) {
  return (
    <article className={compact ? "raw-card compact" : "raw-card"}>
      <div className="raw-title"><Store size={18} /> Response details</div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </article>
  );
}

function HeroEmpty() {
  return (
    <div className="hero-empty">
      <div className="hero-illustration">
        <ShoppingBag size={48} />
      </div>
      <h2>Ready when you are</h2>
      <p>Ask ChatGPT to fetch addresses, search products, review your cart, checkout, or track an Instamart order.</p>
    </div>
  );
}

function EmptyPage({ title, detail, tone, compact }: { title: string; detail: string; tone?: "error"; compact?: boolean }) {
  return (
    <div className={compact ? "empty-page compact" : "empty-page"}>
      {tone === "error" ? <AlertTriangle size={28} /> : <PackageSearch size={28} />}
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

function MessageBar({ success, message }: { success: boolean; message: string }) {
  return (
    <div className={success ? "message-bar success" : "message-bar error"}>
      {success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{message}</span>
    </div>
  );
}

function StatusBadge({ success }: { success?: boolean }) {
  if (success === undefined) return <span className="status-badge">Idle</span>;
  return <span className={success ? "status-badge ok" : "status-badge bad"}>{success ? "Live" : "Issue"}</span>;
}

function cardMotion(index: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.22,
      delay: Math.min(index * 0.035, 0.18),
      ease: [0.2, 0.8, 0.2, 1] as const
    }
  };
}

function extractSnapshot(result: CallToolResult | null): Snapshot | null {
  const candidate = result?.structuredContent;
  if (candidate && typeof candidate === "object" && "service" in candidate) {
    return candidate as unknown as Snapshot;
  }
  return null;
}

function titleForTool(toolName: ToolName) {
  const titles: Record<string, string> = {
    get_addresses: "Choose address",
    create_address: "Address saved",
    delete_address: "Address removed",
    search_products: "Search products",
    search_products_bulk: "Grouped search",
    your_go_to_items: "Go-to items",
    clear_cart: "Cart cleared",
    get_cart: "Cart review",
    update_cart: "Cart updated",
    checkout: "Checkout",
    get_orders: "Orders",
    get_order_details: "Order bill",
    track_order: "Track order",
    report_error: "Support"
  };
  return titles[toolName] || "Instamart";
}

function subtitleForTool(toolName: ToolName, snapshot: Snapshot) {
  const subtitles: Record<string, string> = {
    get_addresses: "Pick where Instamart should deliver",
    create_address: "Saved to your Swiggy account",
    delete_address: "Removed from saved addresses",
    search_products: "Variants and SKUs at your selected address",
    search_products_bulk: "Multiple keyword searches grouped by item",
    your_go_to_items: "Fast reorder from your usual basket",
    clear_cart: "Your Instamart basket is empty",
    get_cart: "Items, bill, and payment methods",
    update_cart: "Synced with Swiggy Instamart",
    checkout: "Order placement status",
    get_orders: "Recent and active Instamart orders",
    get_order_details: "Itemized order summary",
    track_order: "Live ETA and status",
    report_error: "Diagnostic report from Swiggy MCP"
  };
  return subtitles[toolName] || snapshot.stage;
}

function stageLabel(toolName: ToolName) {
  if (["get_addresses", "create_address", "delete_address", "search_products", "search_products_bulk", "your_go_to_items"].includes(toolName)) return "Discover";
  if (["clear_cart", "get_cart", "update_cart"].includes(toolName)) return "Cart";
  if (toolName === "checkout") return "Order";
  if (["get_orders", "get_order_details", "track_order"].includes(toolName)) return "Track";
  if (toolName === "report_error") return "Support";
  return "Instamart";
}

function pickArray(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of keys) {
    const value = readPath(data, key);
    if (Array.isArray(value)) return value;
  }
  for (const nestedRoot of ["structuredContent", "data"]) {
    const nested = (data as Record<string, unknown>)[nestedRoot];
    if (nested && typeof nested === "object") {
      const nestedArray = pickArray(nested, keys);
      if (nestedArray.length) return nestedArray;
    }
  }
  return [];
}

function readString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of keys) {
    const candidate = readPath(value, key);
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (typeof candidate === "number") return String(candidate);
  }
  return undefined;
}

function readNumber(value: unknown, keys: string[]): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of keys) {
    const candidate = readPath(value, key);
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && candidate.trim() && !Number.isNaN(Number(candidate))) return Number(candidate);
  }
  return undefined;
}

function normalizeAddress(address: unknown): SelectedAddress | null {
  const id = readString(address, ["id", "addressId"]);
  if (!id) return null;
  return {
    id,
    label: readString(address, ["addressTag", "label", "name"]) || "Saved address",
    addressLine: readString(address, ["addressLine", "fullAddress", "description"]) || compactJson(address),
    phoneNumber: readString(address, ["phoneNumber", "phone"]),
    addressCategory: readString(address, ["addressCategory", "type"])
  };
}

function readStoredSelectedAddress(): SelectedAddress | null {
  try {
    const raw = window.sessionStorage.getItem(SELECTED_ADDRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SelectedAddress>;
    if (typeof parsed.id !== "string" || typeof parsed.label !== "string" || typeof parsed.addressLine !== "string") {
      return null;
    }
    return {
      id: parsed.id,
      label: parsed.label,
      addressLine: parsed.addressLine,
      phoneNumber: typeof parsed.phoneNumber === "string" ? parsed.phoneNumber : undefined,
      addressCategory: typeof parsed.addressCategory === "string" ? parsed.addressCategory : undefined
    };
  } catch {
    return null;
  }
}

function persistSelectedAddress(address: SelectedAddress) {
  try {
    window.sessionStorage.setItem(SELECTED_ADDRESS_STORAGE_KEY, JSON.stringify(address));
  } catch {
    // Host storage can be unavailable in strict previews; model context still updates when connected.
  }
}

async function updateSelectedAddressModelContext(app: App | undefined, selectedAddress: SelectedAddress) {
  if (!app) return;
  try {
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `The user selected Swiggy Instamart delivery address "${selectedAddress.label}" with addressId ${selectedAddress.id}. Use this addressId for future Instamart search, cart, and checkout tool calls unless the user chooses a different address.`
        }
      ],
      structuredContent: {
        swiggyInstamart: {
          selectedAddress
        }
      }
    });
  } catch (error) {
    console.warn("Could not update model context with selected address.", error);
  }
}

function preferredWidgetHeight(): number {
  const availableHeight = window.screen?.availHeight || window.innerHeight || 1040;
  return Math.max(760, Math.min(availableHeight - 110, 1040));
}

function readMoney(value: unknown, keys: string[]): string | number | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of keys) {
    const candidate = readPath(value, key);
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function formatPrice(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return `₹${value}`;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `₹${trimmed}`;
  return trimmed.startsWith("₹") ? trimmed : trimmed;
}

function readBoolean(value: unknown, keys: string[]): boolean | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of keys) {
    const candidate = readPath(value, key);
    if (typeof candidate === "boolean") return candidate;
  }
  return undefined;
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function compactJson(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function getPreviewResult(): CallToolResult | null {
  const mock = new URLSearchParams(window.location.search).get("mock");
  if (!mock) return null;
  const snapshotByMock: Record<string, Snapshot> = {
    addresses: {
      service: "swiggy-instamart",
      toolName: "get_addresses",
      stage: "discover",
      view: "addresses",
      success: true,
      message: "Found 38 saved addresses (page 1 of 4, showing 10):",
      stateVersion: 1,
      data: {
        total: 38,
        addresses: [
          {
            id: "d0u44r74o47elbjen460",
            addressLine: "simon antony: 11g, Mather Esperanza, Seaport - Airport Road, Kakkanad, Kerala 682037",
            phoneNumber: "****2465",
            addressCategory: "Other",
            addressTag: "flat"
          },
          {
            id: "d6it3pqtc7cvnnk2bat0",
            addressLine: "simon antony: 206i, DD Misty Hills, Kangarappady Navodaya Road, Kakkanad",
            phoneNumber: "****2465",
            addressCategory: "Home",
            addressTag: "dd misty"
          }
        ]
      }
    },
    products: {
      service: "swiggy-instamart",
      toolName: "search_products",
      stage: "discover",
      view: "products",
      success: true,
      message: "Showing available variants for milk.",
      stateVersion: 2,
      data: {
        products: [
          { name: "Amul Taaza Toned Milk", brand: "Amul", variants: [{ packSize: "1 L", displayPrice: "₹74", spinId: "spin_milk_1" }] },
          { name: "Nandini Curd", brand: "Nandini", variants: [{ packSize: "500 g", displayPrice: "₹32", spinId: "spin_curd_1" }] },
          { name: "Tender Coconut", brand: "Fresh", variants: [{ packSize: "1 pc", displayPrice: "₹54", spinId: "spin_coco_1" }] }
        ]
      }
    },
    cart: {
      service: "swiggy-instamart",
      toolName: "get_cart",
      stage: "cart",
      view: "cart",
      success: true,
      message: "Cart ready for review.",
      stateVersion: 3,
      data: {
        grandTotal: "₹160",
        availablePaymentMethods: ["COD"],
        items: [
          { name: "Amul Taaza Toned Milk", quantity: "1 L x 2", displayPrice: "₹148" },
          { name: "Handling fee", quantity: "1", displayPrice: "₹12" }
        ]
      }
    }
  };
  const snapshot = snapshotByMock[mock] ?? snapshotByMock.addresses;
  return {
    content: [{ type: "text", text: `${snapshot.toolName} preview` }],
    structuredContent: snapshot as unknown as Record<string, unknown>
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
