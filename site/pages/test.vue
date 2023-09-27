<template>
  <div>
    <v-row>
      <v-col cols="10" class="pa-0">
        <v-sheet class="d-flex fill-height" color="blue" />
      </v-col>
      <v-col cols="2" class="pa-0">
        <v-sheet class="d-flex" color="red">
          <v-card flat tile>
            <v-card-text>
              <div>Hello world</div>
              <div>Hello world</div>
              <div>Hello world</div>
              <div>Hello world</div>
            </v-card-text>
          </v-card>
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>
<script>
export default {
  data () {
    return {
    }
  },
  async fetch () {
  },
  mounted () {
  },
  methods: {
  }
}
</script>
