<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FnlLeague extends Model
{
    protected $table = 'fnl_leagues';

    protected $fillable = ['name', 'code', 'owner_team_id'];

    protected function casts(): array
    {
        return ['owner_team_id' => 'integer'];
    }

    public function teams()
    {
        return $this->belongsToMany(FnlTeam::class, 'fnl_league_members');
    }
}
