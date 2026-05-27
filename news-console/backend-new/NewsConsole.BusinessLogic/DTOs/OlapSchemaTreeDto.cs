namespace NewsConsole.BusinessLogic.DTOs;

public sealed record OlapSubclusterTreeDto(string Name);

public sealed record OlapClusterTreeDto(string Name, IReadOnlyList<OlapSubclusterTreeDto> Subclusters);

public sealed record OlapSchemaTreeDto(IReadOnlyList<OlapClusterTreeDto> Clusters);