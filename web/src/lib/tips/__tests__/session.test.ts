import { describe, expect, it } from "vitest";
import { parseStoredSession } from "../session";

describe("parseStoredSession", () => {
  it("accepts the localhost bypass payload", () => {
    expect(
      parseStoredSession({
        token: "session-token",
        locationId: "location-id",
        locationName: "Babytuna Sushi",
        closerId: null,
        closerName: null,
      }),
    ).toEqual({
      token: "session-token",
      locationId: "location-id",
      locationName: "Babytuna Sushi",
      closerId: null,
      closerName: null,
    });
  });

  it("rejects incomplete session payloads", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession({ locationId: "location-id" })).toBeNull();
    expect(parseStoredSession({ token: "session-token" })).toBeNull();
    expect(parseStoredSession({ token: "", locationId: "location-id" })).toBeNull();
  });

  it("normalizes optional display fields", () => {
    expect(
      parseStoredSession({ token: "session-token", locationId: "location-id" }),
    ).toEqual({
      token: "session-token",
      locationId: "location-id",
      locationName: "",
      closerId: null,
      closerName: null,
    });
  });
});
