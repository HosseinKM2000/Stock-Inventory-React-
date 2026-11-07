import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..models import (
    InventoryItem,
    InventoryMovement,
    InventoryTransaction,
    Invoice,
    InvoiceLine,
    SyncChange,
    User,
)
from ..schemas import InventoryOut
from .store_service import active_store_context


def _movement_operation(command_id: str, product_id: int, phase: str) -> str:
    return hashlib.sha256(f"invoice:{command_id}:{product_id}:{phase}".encode()).hexdigest()


def _product_record(item: InventoryItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "quantity": item.quantity,
        "version": item.version,
        "status": item.status,
        "updated_at": item.updated_at,
    }


def _invoice_record(invoice: Invoice, *, include_purchase_prices: bool = True) -> dict[str, Any]:
    lines = []
    for line in invoice.lines:
        value = {
            "id": line.id,
            "product_id": line.product_id,
            "product_name": line.product_name,
            "quantity": line.quantity,
            "unit": line.unit,
            "pack_size": line.pack_size,
            "base_quantity": line.base_quantity,
            "unit_price": line.unit_price,
            "line_total": line.line_total,
            "before_quantity": line.before_quantity,
            "after_quantity": line.after_quantity,
        }
        if invoice.invoice_type == "purchase" and not include_purchase_prices:
            value["unit_price"] = None
            value["line_total"] = None
        lines.append(value)
    return {
        "id": invoice.id,
        "invoice_type": invoice.invoice_type,
        "title": invoice.title,
        "counterparty": invoice.counterparty,
        "status": invoice.status,
        "total_amount": invoice.total_amount if include_purchase_prices or invoice.invoice_type == "sale" else None,
        "actor_user_id": invoice.actor_user_id,
        "actor_membership_id": invoice.actor_membership_id,
        "post_operation_id": invoice.post_operation_id,
        "cancel_operation_id": invoice.cancel_operation_id,
        "posted_at": invoice.posted_at,
        "cancelled_at": invoice.cancelled_at,
        "lines": lines,
    }


def invoice_record(invoice: Invoice, *, include_purchase_prices: bool = True) -> dict[str, Any]:
    return _invoice_record(invoice, include_purchase_prices=include_purchase_prices)


def _validated_lines(payload: dict[str, Any]) -> list[dict[str, int | str | None]]:
    raw_lines = payload.get("lines")
    if not isinstance(raw_lines, list) or not 1 <= len(raw_lines) <= 100:
        raise ValueError("INVOICE_LINES_INVALID")
    consolidated: dict[int, dict[str, int | str | None]] = {}
    for raw in raw_lines:
        if not isinstance(raw, dict):
            raise ValueError("INVOICE_LINE_INVALID")
        product_id = raw.get("product_id")
        quantity = raw.get("quantity")
        unit_price = raw.get("unit_price")
        unit = raw.get("unit", "unit")
        pack_size = raw.get("pack_size")
        if isinstance(product_id, bool) or not isinstance(product_id, int):
            raise ValueError("INVOICE_PRODUCT_INVALID")
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
            raise ValueError("INVOICE_QUANTITY_INVALID")
        if isinstance(unit_price, bool) or not isinstance(unit_price, int) or unit_price < 0:
            raise ValueError("INVOICE_PRICE_REQUIRED")
        if unit not in {"unit", "pack"}:
            raise ValueError("INVOICE_UNIT_INVALID")
        if unit == "pack" and (isinstance(pack_size, bool) or not isinstance(pack_size, int) or pack_size <= 0):
            raise ValueError("INVOICE_PACK_SIZE_INVALID")
        normalized_pack = pack_size if unit == "pack" else None
        previous = consolidated.get(product_id)
        if previous is not None:
            if previous["unit"] != unit or previous["unit_price"] != unit_price or previous["pack_size"] != normalized_pack:
                raise ValueError("DUPLICATE_INVOICE_PRODUCT")
            previous["quantity"] = int(previous["quantity"]) + quantity
        else:
            consolidated[product_id] = {
                "product_id": product_id,
                "quantity": quantity,
                "unit_price": unit_price,
                "unit": unit,
                "pack_size": normalized_pack,
            }
    return [consolidated[key] for key in sorted(consolidated)]


def _locked_products(db: Session, store_id: int, product_ids: list[int]) -> dict[int, InventoryItem]:
    rows = db.scalars(
        select(InventoryItem)
        .options(
            joinedload(InventoryItem.catalog_product),
            joinedload(InventoryItem.media_asset),
            selectinload(InventoryItem.labels),
        )
        .where(InventoryItem.store_id == store_id, InventoryItem.id.in_(product_ids))
        .order_by(InventoryItem.id)
        .with_for_update(of=InventoryItem)
    ).unique().all()
    return {item.id: item for item in rows}


def _record_product_change(db: Session, actor: User, item: InventoryItem) -> None:
    record = InventoryOut.model_validate(item).model_dump(mode="json")
    asset = item.media_asset
    if asset is not None:
        record.update({
            "media_version": asset.version,
            "media_content_sha256": asset.content_sha256,
            "media_byte_size": asset.byte_size,
            "media_preview_url": f"/api/media/{asset.id}/preview",
            "media_detail_url": f"/api/media/{asset.id}/detail",
        })
    sale_price = item.sale_price
    record.update({
        "sale_price": sale_price,
        "purchase_price": item.purchase_price,
        "price": sale_price or 0,
        "price_missing": sale_price is None,
    })
    db.add(SyncChange(
        store_id=actor.store_id,
        actor_user_id=actor.id,
        user_id=actor.data_owner_id,
        entity="product",
        entity_id=item.id,
        operation="UPSERT",
        payload=json.dumps(record, ensure_ascii=False, default=str),
    ))


def post_invoice(
    db: Session,
    actor: User,
    *,
    invoice_id: int,
    operation_id: str,
    payload: dict[str, Any],
    client_occurred_at: datetime | None,
) -> dict[str, Any]:
    if db.scalar(select(Invoice).where(Invoice.id == invoice_id, Invoice.store_id == actor.store_id)) is not None:
        raise ValueError("INVOICE_ID_EXISTS")
    invoice_type = payload.get("invoice_type")
    if invoice_type not in {"purchase", "sale"}:
        raise ValueError("INVOICE_TYPE_INVALID")
    title = payload.get("title")
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 200:
        raise ValueError("INVOICE_TITLE_INVALID")
    counterparty = payload.get("counterparty")
    if counterparty is not None and (not isinstance(counterparty, str) or len(counterparty.strip()) > 200):
        raise ValueError("INVOICE_COUNTERPARTY_INVALID")
    lines = _validated_lines(payload)
    products = _locked_products(db, actor.store_id, [int(line["product_id"]) for line in lines])
    if len(products) != len(lines):
        raise ValueError("INVOICE_PRODUCT_NOT_FOUND")
    for item in products.values():
        if item.deleted_at is not None or item.is_hidden:
            raise ValueError("INVOICE_PRODUCT_NOT_ACTIVE")

    context = active_store_context(db, actor)
    now = datetime.now(timezone.utc)
    invoice = Invoice(
        id=invoice_id,
        store_id=context.store.id,
        actor_user_id=actor.id,
        actor_membership_id=context.membership.id,
        invoice_type=invoice_type,
        title=title.strip(),
        counterparty=counterparty.strip() if isinstance(counterparty, str) and counterparty.strip() else None,
        status="posted",
        total_amount=sum(int(line["quantity"]) * int(line["unit_price"]) for line in lines),
        post_operation_id=operation_id,
        posted_at=now,
    )
    db.add(invoice)
    db.flush()
    affected: list[dict[str, Any]] = []
    for position, value in enumerate(lines):
        item = products[int(value["product_id"])]
        pack_size = int(value["pack_size"]) if value["pack_size"] is not None else None
        if value["unit"] == "pack":
            if not item.catalog_product.is_packaged or item.catalog_product.pack_size != pack_size:
                raise ValueError("INVOICE_PACKAGING_MISMATCH")
        base_quantity = int(value["quantity"]) * (pack_size or 1)
        if base_quantity <= 0:
            raise ValueError("INVOICE_QUANTITY_INVALID")
        before = item.quantity
        after = before + base_quantity if invoice_type == "purchase" else before - base_quantity
        if after < 0:
            raise ValueError("INSUFFICIENT_STOCK")
        line = InvoiceLine(
            invoice=invoice,
            store_id=context.store.id,
            product_id=item.id,
            position=position,
            product_name=item.custom_label or item.catalog_product.name,
            quantity=int(value["quantity"]),
            unit="بسته" if value["unit"] == "pack" else "عدد",
            pack_size=pack_size,
            base_quantity=base_quantity,
            unit_price=int(value["unit_price"]),
            line_total=int(value["quantity"]) * int(value["unit_price"]),
            before_quantity=before,
            after_quantity=after,
        )
        db.add(line)
        db.flush()
        movement_id = _movement_operation(operation_id, item.id, "post")
        db.add(InventoryMovement(
            store_id=context.store.id,
            product_id=item.id,
            actor_user_id=actor.id,
            actor_membership_id=context.membership.id,
            operation_id=movement_id,
            kind="receive" if invoice_type == "purchase" else "issue",
            delta=base_quantity if invoice_type == "purchase" else -base_quantity,
            correction_quantity=None,
            scan_source="manual",
            barcode_id=None,
            barcode_value=None,
            scan_quantity=1,
            before_quantity=before,
            after_quantity=after,
            reverses_operation_id=None,
            invoice_id=invoice.id,
            invoice_line_id=line.id,
            client_occurred_at=client_occurred_at,
        ))
        item.quantity = after
        item.version = (item.version or 1) + 1
        db.flush()
        db.add(InventoryTransaction(
            store_id=context.store.id,
            actor_user_id=actor.id,
            user_id=actor.data_owner_id,
            inventory_item_id=item.id,
            type="stock_in" if invoice_type == "purchase" else "stock_out",
            quantity=base_quantity,
            before_quantity=before,
            after_quantity=after,
            note=f"invoice:{invoice.id}",
        ))
        _record_product_change(db, actor, item)
        affected.append(_product_record(item))
    db.flush()
    return {"invoice": _invoice_record(invoice), "products": affected}


def cancel_invoice(
    db: Session,
    actor: User,
    *,
    invoice_id: int,
    operation_id: str,
    client_occurred_at: datetime | None,
) -> dict[str, Any]:
    invoice = db.execute(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.id == invoice_id, Invoice.store_id == actor.store_id)
        .with_for_update(of=Invoice)
    ).unique().scalar_one_or_none()
    if invoice is None:
        raise ValueError("INVOICE_NOT_FOUND")
    if invoice.status == "cancelled":
        raise ValueError("INVOICE_ALREADY_CANCELLED")
    products = _locked_products(db, actor.store_id, sorted(line.product_id for line in invoice.lines))
    if len(products) != len(invoice.lines):
        raise ValueError("INVOICE_PRODUCT_NOT_FOUND")
    if invoice.invoice_type == "purchase":
        for line in invoice.lines:
            if products[line.product_id].quantity < line.base_quantity:
                raise ValueError("INSUFFICIENT_REVERSAL_STOCK")

    context = active_store_context(db, actor)
    affected: list[dict[str, Any]] = []
    for line in sorted(invoice.lines, key=lambda value: value.product_id):
        item = products[line.product_id]
        before = item.quantity
        delta = -line.base_quantity if invoice.invoice_type == "purchase" else line.base_quantity
        after = before + delta
        original_id = _movement_operation(invoice.post_operation_id, item.id, "post")
        db.add(InventoryMovement(
            store_id=context.store.id,
            product_id=item.id,
            actor_user_id=actor.id,
            actor_membership_id=context.membership.id,
            operation_id=_movement_operation(operation_id, item.id, "cancel"),
            kind="reversal",
            delta=delta,
            correction_quantity=None,
            scan_source="manual",
            barcode_id=None,
            barcode_value=None,
            scan_quantity=1,
            before_quantity=before,
            after_quantity=after,
            reverses_operation_id=original_id,
            invoice_id=invoice.id,
            invoice_line_id=line.id,
            client_occurred_at=client_occurred_at,
        ))
        item.quantity = after
        item.version = (item.version or 1) + 1
        db.flush()
        db.add(InventoryTransaction(
            store_id=context.store.id,
            actor_user_id=actor.id,
            user_id=actor.data_owner_id,
            inventory_item_id=item.id,
            type="stock_out" if delta < 0 else "stock_in",
            quantity=abs(delta),
            before_quantity=before,
            after_quantity=after,
            note=f"invoice-cancel:{invoice.id}",
        ))
        _record_product_change(db, actor, item)
        affected.append(_product_record(item))
    invoice.status = "cancelled"
    invoice.cancel_operation_id = operation_id
    invoice.cancelled_at = datetime.now(timezone.utc)
    invoice.cancelled_by_user_id = actor.id
    invoice.cancelled_by_membership_id = context.membership.id
    db.flush()
    return {"invoice": _invoice_record(invoice), "products": affected}
