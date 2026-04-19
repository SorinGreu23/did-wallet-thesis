using System;
using Microsoft.Extensions.Primitives;

namespace DID.Identity.Application.DTOs;

public record DIDDocumentDto(
  string Id,
  string Controller,
  VerificationMethodDto[] VerificationMethod,
  string[] Authentication,
  string[] AssertionMethod,
  DateTime Created
);

public record VerificationMethodDto(
  string Id,
  string Type,
  string Controller,
  string PublicKeyHex
);

public record PublicKeyDto(
  string Id,
  string Type,
  string Controller,
  string PublicKey,
  string Purpose
);

public record CreateDIDRequest(string ControllerAddress);

public record RegisterIdentityRequest(
  string DID,
  string ControllerAddress,
  string? DisplayName,
  string? Email
);

public record RegisteredIdentityDto(
  string DID,
  string ControllerAddress,
  string? DisplayName,
  string? Email,
  DateTime RegisteredAt
);
