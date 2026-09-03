CREATE OR REPLACE FUNCTION notify_category_auction_realtime_from_auction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'favor_category_auction',
    json_build_object(
      'type', 'category_auction.updated',
      'categoryKey', NEW."categoryKey",
      'auctionId', NEW."id",
      'reason', 'auction:' || lower(TG_OP),
      'occurredAt', clock_timestamp()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_category_auction_realtime_from_bid()
RETURNS TRIGGER AS $$
DECLARE
  auction_category_key TEXT;
BEGIN
  SELECT "categoryKey"
  INTO auction_category_key
  FROM "CategoryAuction"
  WHERE "id" = NEW."auctionId";

  IF auction_category_key IS NOT NULL THEN
    PERFORM pg_notify(
      'favor_category_auction',
      json_build_object(
        'type', 'category_auction.updated',
        'categoryKey', auction_category_key,
        'auctionId', NEW."auctionId",
        'reason', 'bid:' || lower(TG_OP),
        'occurredAt', clock_timestamp()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER category_auction_realtime_after_change
AFTER INSERT OR UPDATE ON "CategoryAuction"
FOR EACH ROW EXECUTE FUNCTION notify_category_auction_realtime_from_auction();

CREATE TRIGGER category_auction_bid_realtime_after_change
AFTER INSERT OR UPDATE ON "CategoryAuctionBid"
FOR EACH ROW EXECUTE FUNCTION notify_category_auction_realtime_from_bid();
