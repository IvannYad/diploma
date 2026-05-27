namespace NewsConsole.BusinessLogic.DTOs;

public enum ConnectionStatus { ConnectionFailed, BadFormat, NeedsProcessing, Ready }

/// <param name="Count">Number of documents in news_with_tables; populated only for NeedsProcessing.</param>
public sealed record ConnectionTestDto(
	ConnectionStatus Status,
	string? Message = null,
	int? Count = null,
	string? ActiveProcessId = null);
