using System;
using DID.Shared.Application.Interfaces;
using DID.Shared.Domain;
using Microsoft.EntityFrameworkCore;

namespace DID.Shared.Infrastructure.Persistence;

public class BaseRepository<T, TContext> : IRepository<T>
  where T : Entity
  where TContext : DbContext
{
  protected readonly TContext context;
  protected readonly DbSet<T> dbSet;

  protected BaseRepository(TContext context)
  {
    this.context = context;
    dbSet = context.Set<T>();
  }

  public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default)
    => await dbSet.FindAsync([id], ct);

  public async Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default)
    => await dbSet.ToListAsync(ct);

  public async Task AddAsync(T entity, CancellationToken ct = default)
    => await dbSet.AddAsync(entity, ct);

  public Task UpdateAsync(T entity, CancellationToken ct = default)
  {
    dbSet.Update(entity);
    return Task.CompletedTask;
  }

  public Task DeleteAsync(T entity, CancellationToken ct = default)
  {
    dbSet.Remove(entity);
    return Task.CompletedTask;
  }

  public async Task SaveChangesAsync(CancellationToken ct = default)
    => await context.SaveChangesAsync(ct);
}
