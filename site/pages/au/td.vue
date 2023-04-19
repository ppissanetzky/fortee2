<template>
  <div>
    <!-- DIALOG -->
    <v-dialog
      v-model="dialog"
      max-width="800"
    >
      <v-card v-if="editing">
        <v-toolbar flat color="secondary" class="white--text mb-3">
          <v-toolbar-title>
            {{ editing.id ? `Tournament ${editing.id}` : 'New tournament' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" class="mr-1" @click="duplicate">
            duplicate
          </v-btn>
          <v-btn small outlined color="white" @click="dialog=false">
            cancel
          </v-btn>
        </v-toolbar>
        <v-card-actions>
          <v-text-field
            v-model="editing.name"
            dense
            label="Name"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.every"
            dense
            hide-details
            outlined
            label="Runs every"
            class="mr-2"
            :items="every"
            clearable
          />
          <v-text-field
            v-model="editing.openTime"
            dense
            label="Opens at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.closeTime"
            dense
            label="Closes at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.startTime"
            dense
            label="Starts at"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.partner"
            dense
            hide-details
            outlined
            label="Partner"
            class="mr-2"
            :items="partners"
          />
          <v-text-field
            v-model="editing.host"
            dense
            label="Host"
            outlined
            hide-details
          />
        </v-card-actions>
        <!-- RULES -->
        <Rules v-model="editing.rules" class="pa-2" />
        <v-card-actions>
          <v-spacer />
          <strong class="red--text pr-2">{{ error }}</strong>
          <v-btn
            outlined
            color="primary"
            :loading="saving"
            :disabled="!!error"
            @click="save"
          >
            save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- MAIN  -->
    <v-toolbar color="secondary" class="white--text">
      <v-toolbar-title>TD</v-toolbar-title>
    </v-toolbar>
    <v-text-field
      v-model="search"
      append-icon="mdi-magnify"
      label="Search"
      single-line
      hide-details
      clearable
      class="px-4"
    />
    <v-data-table
      :headers="headers"
      :items="ts"
      :search="search"
      item-key="id"
      @click:row="edit"
    />
  </div>
</template>
<script>
export default {
  data () {
    return {
      ts: [],
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Every', value: 'every', groupable: true },
        { text: 'Opens', value: 'openTime', align: 'end' },
        { text: 'Closes', value: 'closeTime', align: 'end' },
        { text: 'Starts', value: 'startTime', align: 'end' },
        { text: 'Rules', value: 'rulesDesc' }
      ],
      every: [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
        'Saturday', 'Sunday', 'Every day', 'Weekdays'
      ],
      partners: [
        { value: 1, text: 'Random' },
        { value: 2, text: 'Choose' }
      ],
      // Models
      search: undefined,
      dialog: false,
      editing: undefined,
      saving: false,
      error: undefined
    }
  },
  async fetch () {
    const { tournaments } = await this.$axios.$get('/api/tournaments/td')
    this.ts = tournaments
  },
  methods: {
    edit (t) {
      this.editing = JSON.parse(JSON.stringify(t))
      this.dialog = true
    },
    duplicate () {
      this.editing = JSON.parse(JSON.stringify(this.editing))
      this.editing.id = 0
      this.editing.name = ''
    },
    async save () {
      this.saving = true
      try {
        const { error } = await this.$axios.$post('/api/tournaments/td/save', this.editing)
        if (error) {
          this.error = error
          setTimeout(() => { this.error = undefined }, 3000)
        }
      } finally {
        this.saving = false
      }
    }
  }
}
</script>
