<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Player extends Model
{
    /** @use HasFactory<\Database\Factories\PlayerFactory> */
    use HasFactory;

    protected $fillable = [
        'number',
        'name',
        'position',
        'rating',
        'bio',
        'phone',
        'email',
        'photo_url',
        'active',
    ];

    protected $attributes = [
        'active' => true,
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'rating' => 'decimal:1',
        ];
    }

    public function goalEvents(): HasMany
    {
        return $this->hasMany(GoalEvent::class);
    }

    public function assistEvents(): HasMany
    {
        return $this->hasMany(AssistEvent::class);
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }
}
