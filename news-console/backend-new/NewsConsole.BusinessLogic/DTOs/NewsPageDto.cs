namespace NewsConsole.BusinessLogic.DTOs;

public sealed record NewsPageDto(int Total, int Offset, int? Limit, IReadOnlyList<ArticleDto> News);
