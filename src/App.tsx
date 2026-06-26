import React, { useState, useEffect } from "react";
import {
  Camera,
  PackageMinus,
  Search,
  Plus,
  Minus,
  Check,
  X,
  Home,
  Package,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Trash2,
  History,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Product, TransactionItem, HistoryEntry } from "./types";

const INITIAL_INVENTORY: Product[] = [
  { id: "1", name: "Pañales Adulto Talla G", quantity: 45, unit: "paquetes" },
  { id: "2", name: "Leche Deslactosada 1L", quantity: 12, unit: "litros" },
  { id: "3", name: "Paracetamol 500mg", quantity: 30, unit: "cajas" },
  { id: "4", name: "Papel Higiénico", quantity: 24, unit: "rollos" },
  { id: "5", name: "Jabón Neutro", quantity: 15, unit: "piezas" },
];

const LOCAL_STORAGE_KEY = "asilogest_inventory";
const HISTORY_STORAGE_KEY = "asilogest_history";

type Tab = "home" | "inventory" | "history";
type Flow = "none" | "compra" | "salida";
type Step = "camera" | "processing" | "review";

export default function App() {
  const [inventory, setInventory] = useState<Product[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const [currentTab, setCurrentTab] = useState<Tab>("home");
  const [activeFlow, setActiveFlow] = useState<Flow>("none");
  const [flowStep, setFlowStep] = useState<Step>("camera");
  const [tempItems, setTempItems] = useState<TransactionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");

  // New states for adding and deleting
  const [isAdding, setIsAdding] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductUnit, setNewProductUnit] = useState("piezas");
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const startFlow = (flow: Flow) => {
    setActiveFlow(flow);
    setFlowStep("camera");
    setTempItems([]);
  };

  const cancelFlow = () => {
    setActiveFlow("none");
    setFlowStep("camera");
    setTempItems([]);
  };

  const handlePhotoTaken = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFlowStep("processing");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!res.ok) throw new Error("Error en el servidor");

        const data = (await res.json()) as {
          productos: { nombre: string; cantidad: number; unidad: string }[];
        };

        setTempItems(
          data.productos.map((p, i) => ({
            id: `scan-${Date.now()}-${i}`,
            name: p.nombre,
            quantity: p.cantidad,
            unit: p.unidad,
          })),
        );
        setFlowStep("review");
      } catch {
        alert("No se pudo procesar la imagen. Intenta de nuevo.");
        setFlowStep("camera");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateTempItem = <K extends keyof TransactionItem>(
    index: number,
    field: K,
    value: TransactionItem[K],
  ) => {
    const newItems = [...tempItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setTempItems(newItems);
  };

  const updateTempQty = (index: number, delta: number) => {
    const newItems = [...tempItems];
    const currentQty = newItems[index].quantity;
    const next = currentQty + delta;
    if (next >= 0) {
      newItems[index].quantity = next;
      setTempItems(newItems);
    }
  };

  const removeTempItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const addManualItem = () => {
    setTempItems([
      ...tempItems,
      { id: `manual-${Date.now()}`, name: "", quantity: 1, unit: "piezas" },
    ]);
  };

  const confirmTransaction = () => {
    let updatedInventory = [...inventory];
    const newHistoryEntries: HistoryEntry[] = [];

    tempItems.forEach((item) => {
      if (!item.name.trim() || item.quantity <= 0) return;
      const existingIndex = updatedInventory.findIndex(
        (p) =>
          p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase(),
      );

      let prevQty = 0;
      let newQty = 0;

      if (activeFlow === "compra") {
        if (existingIndex >= 0) {
          prevQty = updatedInventory[existingIndex].quantity;
          updatedInventory[existingIndex].quantity += item.quantity;
          newQty = updatedInventory[existingIndex].quantity;
        } else {
          prevQty = 0;
          const newId = item.id || Date.now().toString();
          updatedInventory.push({
            id: newId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          });
          newQty = item.quantity;
        }
        newHistoryEntries.push({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: "compra",
          productName: item.name,
          quantityChange: item.quantity,
          newQuantity: newQty,
        });
      } else if (activeFlow === "salida") {
        if (existingIndex >= 0) {
          prevQty = updatedInventory[existingIndex].quantity;
          updatedInventory[existingIndex].quantity = Math.max(
            0,
            updatedInventory[existingIndex].quantity - item.quantity,
          );
          newQty = updatedInventory[existingIndex].quantity;
          newHistoryEntries.push({
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            type: "salida",
            productName: item.name,
            quantityChange: -item.quantity,
            newQuantity: newQty,
          });
        }
      }
    });

    setInventory(updatedInventory.filter((p) => p.quantity > 0));
    setHistory([...newHistoryEntries, ...history]);
    cancelFlow();
    setCurrentTab("inventory");
  };

  const openAdjustModal = (product: Product) => {
    setAdjustProduct(product);
    setAdjustQuantity(product.quantity);
    setAdjustReason("");
  };

  const confirmAdjust = () => {
    if (adjustProduct) {
      const updatedInventory = inventory.map((p) =>
        p.id === adjustProduct.id ? { ...p, quantity: adjustQuantity } : p,
      );
      setInventory(updatedInventory);

      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: "ajuste",
        productName: adjustProduct.name,
        quantityChange: adjustQuantity - adjustProduct.quantity,
        newQuantity: adjustQuantity,
        reason: adjustReason,
      };
      setHistory([newEntry, ...history]);

      setAdjustProduct(null);
    }
  };

  const deleteProduct = (id: string) => {
    const productToDelete = inventory.find((p) => p.id === id);
    if (productToDelete) {
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: "eliminacion",
        productName: productToDelete.name,
        quantityChange: -productToDelete.quantity,
        newQuantity: 0,
      };
      setHistory([newEntry, ...history]);
    }
    setInventory(inventory.filter((p) => p.id !== id));
  };

  const confirmAdd = () => {
    if (newProductName.trim()) {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: newProductName,
        quantity: newProductQuantity,
        unit: newProductUnit,
      };
      setInventory([...inventory, newProduct]);

      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: "creacion",
        productName: newProductName,
        quantityChange: newProductQuantity,
        newQuantity: newProductQuantity,
      };
      setHistory([newEntry, ...history]);

      setIsAdding(false);
      setNewProductName("");
      setNewProductQuantity(1);
      setNewProductUnit("piezas");
    }
  };

  const renderHome = () => (
    <div className="p-8 space-y-6">
      <div className="mb-10 mt-4">
        <h1 className="text-4xl font-serif italic text-natural-green-dark">
          Asilo Vida Plena
        </h1>
        <p className="text-natural-text-light text-xs uppercase tracking-widest mt-2">
          Sistema de Gestión Amigable
        </p>
      </div>

      <button
        onClick={() => startFlow("compra")}
        className="w-full bg-natural-green text-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(136,158,129,0.2)] border border-white/10 flex flex-col items-center justify-center space-y-4 transition-transform active:scale-95"
      >
        <div className="w-[70px] h-[70px] bg-white/20 rounded-full flex items-center justify-center">
          <Camera size={32} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-serif mb-2">Registrar Compra</h2>
          <p className="text-white/90 text-sm">
            Toma una foto al ticket para que la IA registre los productos.
          </p>
        </div>
      </button>

      <button
        onClick={() => startFlow("salida")}
        className="w-full bg-natural-green text-white p-8 rounded-[32px] shadow-[0_10px_30px_rgba(136,158,129,0.2)] border border-white/10 flex flex-col items-center justify-center space-y-4 transition-transform active:scale-95"
      >
        <div className="w-[70px] h-[70px] bg-white/20 rounded-full flex items-center justify-center">
          <PackageMinus size={32} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-serif mb-2">Registrar Salida</h2>
          <p className="text-white/90 text-sm">
            Toma una foto a la libreta de uso diario de suministros.
          </p>
        </div>
      </button>
    </div>
  );

  const renderHistory = () => {
    return (
      <div className="p-8 flex flex-col h-full">
        <div className="flex justify-between items-center mb-8 mt-2">
          <h1 className="text-3xl font-serif text-natural-text">Historial</h1>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "¿Estás seguro de que deseas limpiar todo el historial?",
                )
              ) {
                setHistory([]);
              }
            }}
            className="text-natural-clay text-xs font-bold uppercase tracking-widest hover:underline"
          >
            Limpiar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-24">
          {history.length === 0 ? (
            <div className="text-center py-12 text-natural-text-light">
              <History size={48} className="mx-auto mb-4 opacity-20" />
              <p>No hay registros todavía.</p>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="bg-natural-card p-5 rounded-[28px] shadow-[0_5px_15px_rgba(0,0,0,0.02)] border border-natural-border"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <div
                      className={`p-2 rounded-full mr-3 ${
                        entry.type === "compra" || entry.type === "creacion"
                          ? "bg-natural-green/10 text-natural-green-dark"
                          : entry.type === "salida" ||
                              entry.type === "eliminacion"
                            ? "bg-natural-clay/10 text-natural-green-dark"
                            : "bg-natural-sand text-natural-text-light"
                      }`}
                    >
                      {entry.type === "compra" || entry.type === "creacion" ? (
                        <TrendingUp size={16} />
                      ) : entry.type === "salida" ||
                        entry.type === "eliminacion" ? (
                        <TrendingDown size={16} />
                      ) : (
                        <History size={16} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-natural-text leading-tight">
                        {entry.productName}
                      </h4>
                      <p className="text-[10px] text-natural-text-light uppercase tracking-widest mt-0.5">
                        {new Date(entry.date).toLocaleString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-lg font-serif font-bold ${
                        entry.quantityChange > 0
                          ? "text-natural-green-dark"
                          : entry.quantityChange < 0
                            ? "text-natural-green-dark"
                            : "text-natural-text-light"
                      }`}
                    >
                      {entry.quantityChange > 0 ? "+" : ""}
                      {entry.quantityChange}
                    </span>
                    <p className="text-[9px] text-natural-text-light font-bold uppercase tracking-tighter">
                      Total: {entry.newQuantity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-natural-border/50">
                  <span className="text-[10px] bg-natural-sand px-2 py-0.5 rounded-full text-natural-text-light font-bold uppercase tracking-widest">
                    {entry.type === "compra"
                      ? "Compra"
                      : entry.type === "salida"
                        ? "Salida"
                        : entry.type === "ajuste"
                          ? "Ajuste"
                          : entry.type === "creacion"
                            ? "Nuevo"
                            : "Eliminado"}
                  </span>
                  {entry.reason && (
                    <p className="text-xs text-natural-text-light italic max-w-[150px] truncate">
                      "{entry.reason}"
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    const filtered = inventory.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
      <div className="p-8 flex flex-col h-full">
        <div className="flex justify-between items-center mb-8 mt-2">
          <h1 className="text-3xl font-serif text-natural-text">
            Vista Rápida
          </h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsAdding(true)}
              className="bg-natural-green text-white p-2.5 rounded-full shadow-md hover:bg-natural-green-dark transition-colors"
              title="Agregar producto"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              className={`${isDeleteMode ? "bg-natural-clay text-white" : "bg-natural-sand text-natural-text-light"} p-2.5 rounded-full shadow-md transition-colors`}
              title="Eliminar productos"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        <div className="relative mb-8">
          <Search
            className="absolute left-5 top-1/2 -translate-y-1/2 text-natural-text-light"
            size={20}
          />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-5 py-4 bg-natural-card border border-natural-border rounded-[24px] focus:outline-none focus:border-natural-green focus:ring-1 focus:ring-natural-green transition-all shadow-[0_5px_15px_rgba(0,0,0,0.02)] text-natural-text"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-24">
          {filtered.map((product) => (
            <div
              key={product.id}
              onClick={() => !isDeleteMode && openAdjustModal(product)}
              className={`bg-natural-card p-6 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-natural-border flex items-center justify-between transition-colors ${!isDeleteMode ? "cursor-pointer hover:border-natural-green/50" : "border-natural-clay/30"}`}
            >
              <div>
                <h3 className="font-semibold text-natural-text text-lg">
                  {product.name}
                </h3>
                <p className="text-xs text-natural-text-light mt-1">
                  {isDeleteMode
                    ? "Toca el icono para eliminar"
                    : "Toca para corregir"}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <span
                    className={`text-2xl font-serif font-bold ${product.quantity <= 5 ? "text-natural-green-dark" : "text-natural-green-dark"}`}
                  >
                    {product.quantity}
                  </span>
                  <p className="text-[10px] text-natural-text-light uppercase tracking-widest mt-1">
                    {product.unit}
                  </p>
                </div>
                {isDeleteMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProduct(product.id);
                    }}
                    className="p-3 bg-natural-clay/10 text-natural-green-dark rounded-full hover:bg-natural-clay hover:text-white transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-natural-text-light">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p>No se encontraron productos.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFlow = () => {
    const isCompra = activeFlow === "compra";

    if (flowStep === "camera") {
      return (
        <div className="flex flex-col h-full bg-natural-bg">
          <div className="p-6 flex items-center mt-2">
            <button
              onClick={cancelFlow}
              className="p-3 text-natural-text-light hover:bg-natural-sand rounded-full transition-colors"
            >
              <ChevronLeft size={28} />
            </button>
            <h2 className="text-2xl font-serif text-natural-text ml-2">
              {isCompra ? "Registrar Compra" : "Registrar Salida"}
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12">
            <div className="text-center px-4">
              <p className="text-natural-text text-lg leading-relaxed">
                {isCompra
                  ? "Toma una foto al ticket para que la IA registre los productos."
                  : "Toma una foto a la libreta de uso diario de suministros."}
              </p>
            </div>

            <label className="w-64 h-64 bg-natural-sand text-natural-green-dark rounded-full flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(136,158,129,0.15)] cursor-pointer hover:bg-natural-sand/80 transition-colors border-4 border-natural-border">
              <Camera size={64} className="mb-4 opacity-80" />
              <span className="font-serif font-bold text-2xl">
                Abrir Cámara
              </span>
              <span className="text-[10px] bg-white/40 px-3 py-1 rounded-full uppercase tracking-widest mt-3 font-bold">
                Cámara Lista
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoTaken}
              />
            </label>
          </div>
        </div>
      );
    }

    if (flowStep === "processing") {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-6 p-8 bg-natural-bg">
          <Loader2 size={64} className="animate-spin text-natural-green" />
          <h2 className="text-3xl font-serif text-natural-text text-center">
            Analizando imagen...
          </h2>
          <p className="text-natural-text-light text-center text-lg">
            Identificando productos y cantidades.
          </p>
        </div>
      );
    }

    if (flowStep === "review") {
      return (
        <div className="flex flex-col h-full bg-natural-bg">
          <div className="p-6 flex items-center bg-natural-bg z-10 mt-2">
            <button
              onClick={cancelFlow}
              className="p-3 text-natural-text-light hover:bg-natural-sand rounded-full transition-colors"
            >
              <X size={24} />
            </button>
            <div className="ml-3">
              <h2 className="text-2xl font-serif text-natural-text">
                Revisar Propuesta
              </h2>
              <p className="text-sm text-natural-text-light mt-1">
                Corrige si hay algún error
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-32">
            {tempItems.length === 0 && (
              <div className="text-center py-10 text-natural-text-light">
                No se detectaron artículos. Agrega uno manualmente.
              </div>
            )}

            {tempItems.map((item, index) => (
              <div
                key={item.id}
                className="bg-natural-card p-6 rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-natural-border relative"
              >
                <button
                  onClick={() => removeTempItem(index)}
                  className="absolute -top-3 -right-3 bg-natural-clay text-white p-2 rounded-full shadow-md hover:bg-natural-clay/80 transition-colors"
                >
                  <X size={16} />
                </button>

                <div className="mb-6">
                  <label className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest">
                    Producto
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      updateTempItem(index, "name", e.target.value)
                    }
                    placeholder="Nombre del producto"
                    className="w-full text-xl font-semibold text-natural-text border-b border-natural-border focus:border-natural-green py-2 outline-none transition-colors bg-transparent mt-1"
                  />
                </div>

                {item.quantity === 0 && (
                  <p className="text-xs text-natural-clay font-bold flex items-center mb-4">
                    <AlertCircle size={14} className="mr-1" /> Cantidad inválida — corrige antes de confirmar
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-sm text-natural-text-light font-bold uppercase tracking-widest">
                    Cantidad
                  </label>
                  <div className="flex items-center space-x-4 bg-natural-sand rounded-[24px] p-1.5">
                    <button
                      onClick={() => updateTempQty(index, -1)}
                      className="p-3 bg-natural-card rounded-[20px] shadow-sm text-natural-text hover:text-natural-green-dark active:scale-95 transition-all"
                    >
                      <Minus size={20} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantity === 0 ? "" : String(item.quantity)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        updateTempItem(index, "quantity", raw === "" ? 0 : parseInt(raw, 10));
                      }}
                      placeholder="0"
                      className="font-serif font-bold text-2xl w-14 text-center text-natural-green-dark bg-transparent outline-none border-b border-natural-border focus:border-natural-green transition-colors placeholder:text-natural-text-light/40"
                    />
                    <button
                      onClick={() => updateTempQty(index, 1)}
                      className="p-3 bg-natural-card rounded-[20px] shadow-sm text-natural-text hover:text-natural-green-dark active:scale-95 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <label className="text-sm text-natural-text-light font-bold uppercase tracking-widest">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateTempItem(index, "unit", e.target.value)}
                    placeholder="Ej. cajas"
                    className="text-right text-natural-text font-semibold bg-transparent border-b border-natural-border focus:border-natural-green outline-none py-1 w-32 transition-colors"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addManualItem}
              className="w-full py-6 border-2 border-dashed border-natural-green/30 text-natural-green-dark rounded-[32px] font-semibold flex items-center justify-center hover:bg-natural-green/5 transition-colors text-lg"
            >
              <Plus size={24} className="mr-2" /> Agregar artículo
            </button>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-natural-bg via-natural-bg to-transparent max-w-md mx-auto">
            <button
              onClick={confirmTransaction}
              disabled={tempItems.some((i) => i.name.trim() && i.quantity <= 0)}
              className="w-full bg-natural-green disabled:bg-natural-sand disabled:text-natural-text-light disabled:cursor-not-allowed hover:bg-natural-green-dark text-white py-5 rounded-[32px] font-serif text-xl shadow-[0_10px_30px_rgba(136,158,129,0.3)] flex items-center justify-center transition-transform active:scale-95"
            >
              <Check size={24} className="mr-2" />
              Confirmar {isCompra ? "Compra" : "Salida"}
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-md mx-auto bg-natural-bg h-screen flex flex-col relative shadow-2xl overflow-hidden font-sans text-natural-text">
      <div className="flex-1 overflow-y-auto">
        {activeFlow !== "none"
          ? renderFlow()
          : currentTab === "home"
            ? renderHome()
            : currentTab === "inventory"
              ? renderInventory()
              : renderHistory()}
      </div>

      {activeFlow === "none" && (
        <div className="bg-natural-card border-t border-natural-border flex justify-around p-3 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.02)] z-10 relative">
          <button
            onClick={() => setCurrentTab("home")}
            className={`flex flex-col items-center py-2 px-4 rounded-[20px] transition-colors ${currentTab === "home" ? "text-natural-green-dark bg-natural-sand" : "text-natural-text-light hover:text-natural-text"}`}
          >
            <Home size={22} className="mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Inicio
            </span>
          </button>
          <button
            onClick={() => setCurrentTab("inventory")}
            className={`flex flex-col items-center py-2 px-4 rounded-[20px] transition-colors ${currentTab === "inventory" ? "text-natural-green-dark bg-natural-sand" : "text-natural-text-light hover:text-natural-text"}`}
          >
            <Package size={22} className="mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Inventario
            </span>
          </button>
          <button
            onClick={() => setCurrentTab("history")}
            className={`flex flex-col items-center py-2 px-4 rounded-[20px] transition-colors ${currentTab === "history" ? "text-natural-green-dark bg-natural-sand" : "text-natural-text-light hover:text-natural-text"}`}
          >
            <History size={22} className="mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Historial
            </span>
          </button>
        </div>
      )}

      {adjustProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-natural-card rounded-[32px] p-8 w-full max-w-sm shadow-[0_20px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in duration-200 border border-natural-border">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-serif text-natural-text">
                  Corregir
                </h3>
                <p className="text-natural-text-light mt-1 text-sm">
                  {adjustProduct.name}
                </p>
              </div>
              <button
                onClick={() => setAdjustProduct(null)}
                className="p-2 bg-natural-sand text-natural-text-light rounded-full hover:text-natural-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-8">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-text-light mb-4 text-center">
                Cantidad Real
              </label>
              <div className="flex items-center justify-center space-x-6 bg-natural-sand p-3 rounded-[24px]">
                <button
                  onClick={() =>
                    setAdjustQuantity(Math.max(0, adjustQuantity - 1))
                  }
                  className="p-4 bg-natural-card rounded-[16px] shadow-sm text-natural-text hover:text-natural-green-dark active:scale-95 transition-all"
                >
                  <Minus size={24} />
                </button>
                <span className="font-serif font-bold text-4xl w-16 text-center text-natural-green-dark">
                  {adjustQuantity}
                </span>
                <button
                  onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                  className="p-4 bg-natural-card rounded-[16px] shadow-sm text-natural-text hover:text-natural-green-dark active:scale-95 transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-text-light mb-3">
                Motivo del ajuste
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ej. Producto caducado, error de conteo..."
                className="w-full p-4 bg-natural-bg border border-natural-border rounded-[20px] focus:bg-natural-card focus:border-natural-green focus:ring-1 focus:ring-natural-green outline-none resize-none h-28 transition-all text-sm"
              />
            </div>

            <button
              onClick={confirmAdjust}
              disabled={Boolean(
                (adjustQuantity !== adjustProduct.quantity &&
                  !adjustReason.trim()) ||
                adjustQuantity === adjustProduct.quantity,
              )}
              className="w-full bg-natural-green disabled:bg-natural-sand disabled:text-natural-text-light disabled:cursor-not-allowed hover:bg-natural-green-dark text-white py-5 rounded-[32px] font-serif text-xl shadow-[0_10px_30px_rgba(136,158,129,0.2)] flex items-center justify-center transition-all"
            >
              <Check size={24} className="mr-2" />
              Guardar
            </button>
            {!adjustReason.trim() &&
              adjustQuantity !== adjustProduct.quantity && (
                <p className="text-center text-xs text-natural-green-dark mt-4 flex items-center justify-center">
                  <AlertCircle size={14} className="mr-1" /> Debes ingresar un
                  motivo
                </p>
              )}
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-natural-card rounded-[32px] p-8 w-full max-w-sm shadow-[0_20px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in duration-200 border border-natural-border">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-serif text-natural-text">
                  Nuevo Producto
                </h3>
                <p className="text-natural-text-light mt-1 text-sm">
                  Completa los detalles
                </p>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 bg-natural-sand text-natural-text-light rounded-full hover:text-natural-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-text-light mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Ej. Jabón de manos"
                className="w-full p-4 bg-natural-bg border border-natural-border rounded-[20px] focus:bg-natural-card focus:border-natural-green focus:ring-1 focus:ring-natural-green outline-none transition-all text-sm font-semibold"
              />
            </div>

            <div className="mb-6 flex space-x-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-text-light mb-2 text-center">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={newProductQuantity}
                  onChange={(e) =>
                    setNewProductQuantity(parseInt(e.target.value) || 1)
                  }
                  min={1}
                  placeholder="1"
                  className="w-full p-4 bg-natural-bg border border-natural-border rounded-[20px] focus:bg-natural-card focus:border-natural-green focus:ring-1 focus:ring-natural-green outline-none transition-all text-sm font-semibold text-center"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-natural-text-light mb-2 text-center">
                  Unidad
                </label>
                <input
                  type="text"
                  value={newProductUnit}
                  onChange={(e) => setNewProductUnit(e.target.value)}
                  placeholder="Ej. cajas"
                  className="w-full p-4 bg-natural-bg border border-natural-border rounded-[20px] focus:bg-natural-card focus:border-natural-green focus:ring-1 focus:ring-natural-green outline-none transition-all text-sm font-semibold text-center"
                />
              </div>
            </div>

            <button
              onClick={confirmAdd}
              disabled={!newProductName.trim() || newProductQuantity < 1}
              className="w-full bg-natural-green disabled:bg-natural-sand disabled:text-natural-text-light disabled:cursor-not-allowed hover:bg-natural-green-dark text-white py-5 rounded-[32px] font-serif text-xl shadow-[0_10px_30px_rgba(136,158,129,0.2)] flex items-center justify-center transition-all"
            >
              <Check size={24} className="mr-2" />
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
