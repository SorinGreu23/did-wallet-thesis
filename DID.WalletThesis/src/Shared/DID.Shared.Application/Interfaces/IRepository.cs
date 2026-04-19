using DID.Shared.Domain;

namespace DID.Shared.Application.Interfaces;

public interface IRepository<T> where T : Entity
{
  Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);
  Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default);
  Task AddAsync(T entity, CancellationToken ct = default);
  Task UpdateAsync(T entity, CancellationToken ct = default);
  Task DeleteAsync(T entity, CancellationToken ct = default);
  Task SaveChangesAsync(CancellationToken ct = default);
}
