

def gini(values: list[int]) -> float:
    """Compute Gini coefficient of cluster sizes (0 = equal, higher = more skew).

    Args:
        values: Per-cluster article counts.

    Returns:
        Gini index in [0, 1], or 0.0 for empty input.
    """
    if not values:
        return 0.0
    sorted_values = sorted(values)
    n = len(sorted_values)
    cumulative = 0
    for index, value in enumerate(sorted_values, start=1):
        cumulative += index * value
    total = sum(sorted_values)
    if total == 0:
        return 0.0
    return (2 * cumulative) / (n * total) - (n + 1) / n
