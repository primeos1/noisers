<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlayerAbsenceResource;
use App\Models\PlayerAbsence;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PlayerAbsenceController extends Controller
{
    /**
     * Public — every injury, trip and suspension, latest start first.
     */
    public function index()
    {
        return PlayerAbsenceResource::collection(
            PlayerAbsence::query()->orderByDesc('starts_on')->orderByDesc('id')->get()
        );
    }

    public function store(Request $request)
    {
        $this->authorize('create', PlayerAbsence::class);

        $absence = PlayerAbsence::create($request->validate($this->rules()));

        return new PlayerAbsenceResource($absence);
    }

    public function update(Request $request, PlayerAbsence $playerAbsence)
    {
        $this->authorize('update', $playerAbsence);

        $data = $request->validate($this->rules(partial: true));

        // A partial patch still has to leave the return date on or after the start.
        $starts = $data['starts_on'] ?? $playerAbsence->starts_on->toDateString();
        $ends = array_key_exists('ends_on', $data) ? $data['ends_on'] : $playerAbsence->ends_on?->toDateString();
        if ($ends !== null && $ends < $starts) {
            throw ValidationException::withMessages([
                'ends_on' => ['The return date must be on or after the start date.'],
            ]);
        }

        $playerAbsence->update($data);

        return new PlayerAbsenceResource($playerAbsence);
    }

    public function destroy(PlayerAbsence $playerAbsence)
    {
        $this->authorize('delete', $playerAbsence);

        $playerAbsence->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'player_id' => [$required, 'integer', 'exists:players,id'],
            'type' => [$required, 'in:injury,travel,suspension,other'],
            'reason' => ['nullable', 'string', 'max:255'],
            'starts_on' => [$required, 'date'],
            'ends_on' => ['nullable', 'date', ...($partial ? [] : ['after_or_equal:starts_on'])],
        ];
    }
}
