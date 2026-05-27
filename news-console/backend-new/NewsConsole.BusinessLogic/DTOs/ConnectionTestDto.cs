namespace NewsConsole.BusinessLogic.DTOs;

public enum ConnectionStatus { ConnectionFailed, BadFormat, NeedsProcessing, Ready }

public sealed record ConnectionTestDto(
	ConnectionStatus Status,
	string? Message = null,
	int? Count = null,
	string? ActiveProcessId = null);
